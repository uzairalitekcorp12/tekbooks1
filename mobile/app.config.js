const fs = require('node:fs');
const path = require('node:path');

const regular = './assets/fonts/Lufga-Regular.ttf';
const medium = './assets/fonts/Lufga-Medium.ttf';
const hasLufga = fs.existsSync(path.join(__dirname, regular)) && fs.existsSync(path.join(__dirname, medium));

module.exports = ({ config }) => {
  const plugins = [...(config.plugins || [])];
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

  return {
    ...config,
    version: '1.0.14',
    plugins,
    extra: {
      ...(config.extra || {}),
      hasEmbeddedLufga: hasLufga,
    },
  };
};
