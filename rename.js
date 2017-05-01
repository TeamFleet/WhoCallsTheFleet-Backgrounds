const glob = require('glob-promise')
const fs = require('fs-extra')
const path = require('path')

glob('./src/blured/*.jpg')
    .then(files => new Promise((resolve, rejact) => {
        console.log(files)
        files.forEach(file => {
            fs.moveSync(file, file.replace(/\.jpg$/, '.png'))
        })
        resolve()
    }))