const fs = require('node:fs');
const path = require('node:path');
const base = require('./app.json').expo;

const regular = './assets/fonts/Lufga-Regular.ttf';
const medium = './assets/fonts/Lufga-Medium.ttf';
const hasLufga = fs.existsSync(path.join(__dirname, regular)) && fs.existsSync(path.join(__dirname, medium));

const plugins = [...(base.plugins || [])];
if (hasLufga) {
  plugins.push([
    'expo-font',
    {
      android: {
        fonts: [
          {
            fontFamily: 'Lufga',
            fontDefinitions: [
              { path: regular, weight: 400 },
              { path: medium, weight: 500 },
            ],
          },
        ],
      },
      ios: {
        fonts: [regular, medium],
      },
    },
  ]);
}

module.exports = {
  expo: {
    ...base,
    version: '1.0.9',
    plugins,
    extra: {
      ...(base.extra || {}),
      hasEmbeddedLufga: hasLufga,
    },
  },
};
