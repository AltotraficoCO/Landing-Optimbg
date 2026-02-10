const { resolve } = require('path')
const { defineConfig } = require('vite')

module.exports = defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        thankyou: resolve(__dirname, 'thank-you.html'),
      },
    },
  },
  // Serve /thank-you instead of /thank-you.html
  appType: 'mpa',
})
