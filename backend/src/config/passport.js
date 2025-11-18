// backend/src/config/passport.js
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  SERVER_URL = "http://localhost:4000",
  GITHUB_CALLBACK_URL,
  GOOGLE_CALLBACK_URL,
} = process.env;

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).lean();
    done(null, user || null);
  } catch (e) {
    done(e);
  }
});

async function uniqueUsername(base) {
  const usernameBase = (base || "player").toLowerCase().replace(/\s+/g, "");
  let finalName = usernameBase || "player";
  let i = 1;
  while (await User.findOne({ username: finalName })) {
    i += 1;
    finalName = `${usernameBase}${i}`;
  }
  return finalName;
}

/* ---------- GitHub ---------- */
if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL:
          GITHUB_CALLBACK_URL || `${SERVER_URL}/api/auth/github/callback`,
        scope: ["user:email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const githubId = String(profile.id);
          const email =
            (profile.emails && profile.emails[0] && profile.emails[0].value) ||
            `${githubId}@users.noreply.github.com`;

          let user =
            (await User.findOne({ githubId })) ||
            (await User.findOne({ email }));

          if (!user) {
            const uname = await uniqueUsername(
              profile.username || profile.displayName || email?.split("@")[0]
            );
            user = await User.create({
              username: uname,
              email,
              githubId,
              avatar:
                (profile.photos && profile.photos[0] && profile.photos[0].value) ||
                "",
              emailVerified: !!email && !email.endsWith("users.noreply.github.com"),
            });
          } else {
            if (!user.githubId) user.githubId = githubId;
            if (!user.avatar && profile.photos && profile.photos[0]) {
              user.avatar = profile.photos[0].value;
            }
            await user.save();
          }

          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}

/* ---------- Google ---------- */
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL:
          GOOGLE_CALLBACK_URL || `${SERVER_URL}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email =
            (profile.emails && profile.emails[0] && profile.emails[0].value) ||
            null;
          const googleId = String(profile.id);
          const avatar =
            (profile.photos && profile.photos[0] && profile.photos[0].value) ||
            "";

          let user =
            (await User.findOne({ googleId })) ||
            (email ? await User.findOne({ email }) : null);

          if (!user) {
            const uname = await uniqueUsername(
              profile.displayName || email?.split("@")[0] || `g_${googleId}`
            );
            user = await User.create({
              username: uname,
              email,
              googleId,
              avatar,
              emailVerified: !!email, // Google ให้ verified email อยู่แล้ว
            });
          } else {
            if (!user.googleId) user.googleId = googleId;
            if (!user.avatar && avatar) user.avatar = avatar;
            if (email && !user.email) user.email = email;
            if (email) user.emailVerified = true;
            await user.save();
          }

          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}

module.exports = passport;
