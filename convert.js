const glob = require('glob-promise')
const Q = require('q')
const fs = require('fs-extra')
const path = require('path')

// const webp = require('webp-converter')
const imagemin = require('imagemin')
const imageminGuetzli = require('imagemin-guetzli')
const imageminWebp = require('imagemin-webp')

const dirOutput = './output'

const getOptions = (settings = {}) => Object.assign({
    output: dirOutput,
    webpQuality: 80,
    GuetzliQuality: 84,
    logType: 'Original'
}, settings)

const convert = (files, settings) => new Promise((resolve, reject) => {
    let options = getOptions(settings)

    let chain = Q.fcall(() => { })

    files.forEach(file => {
        chain = chain.then(() => convertFile(file, settings))
    })

    chain = chain.then(() => {
        console.log(options.logType + ' success')
        resolve()
    }).catch(err => {
        console.log(123123)
        console.log(err)
        reject(err)
    })
})

const convertFile = (file, settings) => {
    let options = getOptions(settings)

    const { output, webpQuality, GuetzliQuality, logType } = options

    console.log(path.basename(file) + ' - ' + logType)

    return imagemin([file], output, {
        plugins: [
            imageminWebp({ quality: webpQuality })
        ]
    }).then(files => {
        console.log(path.basename(file) + ' - ' + logType + ' - webp - Converted Successfully')
    }).then(() => imagemin([file], output, {
        plugins: [
            imageminGuetzli({ quality: GuetzliQuality })
        ]
    }).then(files => {
        console.log(path.basename(file) + ' - ' + logType + ' - jpeg - Converted Successfully')
    }))
        .catch(err => {
            console.log(err)
        })
}

// ensure dir: /output
fs.ensureDir(dirOutput)
    .then(() => fs.emptyDir(dirOutput))

    // convert original
    .then(() => glob('./src/*.png'))
    .then(files => convert(files))

    // convert blured
    .then(() => glob('./src/blured/*.png'))
    .then(files => convert(files, {
        output: path.resolve(dirOutput, 'blured'),
        webpQuality: 90,
        GuetzliQuality: 84,
        logType: 'Blured'
    }))

    // rename all .png to .jpg
    .then(() => glob(dirOutput + '/**/*.png'))
    .then(files => new Promise((resolve, rejact) => {
        files.forEach(file => {
            fs.moveSync(file, file.replace(/\.png$/, '.jpg'))
        })
        resolve()
    }))

    // copy /src/thumbnail
    .then(() => fs.copy('./src/thumbnail', path.resolve(dirOutput, 'thumbnail')))

    .then(() => {
        console.log('')
        console.log('done')
    })

    .catch(err => {
        console.log(err)
    })