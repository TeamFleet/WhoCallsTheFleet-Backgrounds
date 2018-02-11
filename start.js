const fs = require('fs-extra')
const path = require('path')
const ora = require('ora')
const spinners = require('cli-spinners')
const ProgressBar = require('progress')
const glob = require('glob-promise')
const ncp = require('ncp').ncp
const imagemin = require('imagemin')
const imageminGuetzli = require('imagemin-guetzli')
const imageminWebp = require('imagemin-webp')

const strPaddingLength = 60
const strPaddingStr = '─'

const files = {
    normal: [],
    blured: [],
    thumbnail: [],
}
const dir = {
    source: path.resolve(__dirname, './src'),
    output: path.resolve(__dirname, './output')
}

const logWIP = str => console.log('\x1b[31m' + '× \x1b[91m[WIP] \x1b[0m' + str)
const spinner = (options = {}) => {
    const waiting = ora(
        Object.assign(
            {
                spinner: spinners.dots,
                color: 'cyan'
            },
            typeof options === 'string' ? {
                text: options
            } : options
        )
    ).start()

    return waiting
}
const process = async (title, files, extname, type) => {
    const run = async (files, extname, onProgress) => new Promise(async (resolve/*, reject*/) => {
        if (Array.isArray(extname)) {
            for (const t of extname) {
                await run(files, t, onProgress)
            }
            return resolve()
        }

        const processFile = async (file) => {
            const plugins = []
            const options = extname.split(':')
            const ext = options[0]
            const quality = options[1] || undefined
            let outputPath = path.resolve(dir.output, './')

            let isFail = false

            switch (ext) {
                case 'webp': {
                    plugins.push(
                        imageminWebp({ quality: quality || 80 })
                    )
                    break
                }
                case 'jpg': {
                    plugins.push(
                        imageminGuetzli({ quality: quality || 84 })
                    )
                    break
                }
            }
            switch (type) {
                case 'blured': {
                    outputPath = path.resolve(outputPath, './blured')
                    break
                }
                case 'thumbnail': {
                    outputPath = path.resolve(outputPath, './thumbnail')
                    break
                }
            }

            const result = await imagemin(
                [file],
                outputPath,
                {
                    plugins
                }
            )
                .catch((/*err*/) => {
                    // console.log(err)
                    isFail = true
                })

            if (isFail) {
                await processFile(file)
            } else {
                for (const file of result) {
                    const {
                        path: pathname
                    } = file
                    await fs.rename(
                        pathname,
                        path.resolve(
                            path.dirname(pathname),
                            path.basename(pathname, path.extname(pathname)) + '.' + ext
                        )
                    )
                }

                if (typeof onProgress === 'function')
                    onProgress(file)
            }
        }

        for (const file of files) {
            await processFile(file)
        }

        resolve()
    })

    const step = title
    const spinnerObj = spinners.dots

    let interval
    let currentFrame = 0
    let completed = 0
    const total = files.length * (Array.isArray(extname) ? extname.length : 1)

    const symbolTicking = () => {
        let symbol = '\x1b[36m' + spinnerObj.frames[currentFrame] + '\x1b[0m'
        bar.tick(0, {
            symbol
        })
        currentFrame++
        if (currentFrame > spinnerObj.frames.length - 1)
            currentFrame = 0
    }

    const bar = new ProgressBar(
        `:symbol ${step} [:bar] :current / :total`,
        {
            total,
            width: 20,
            complete: '■',
            incomplete: '─',
            clear: true
        }
    )
    symbolTicking()
    interval = setInterval(symbolTicking, spinnerObj.interval)

    await run(files, extname, () => {
        // console.log(currentShipIndex, shipsCount)
        bar.tick()
        completed++
    })
        // .then((/*isSuccess*/) => {
        //     waiting.stop()
        //     clearInterval(interval)
        //     spinner(step).finish()
        // })
        .catch(err =>
            spinner(step).fail(step + '\n  ' + (err.message || err))
        )

    if (bar) bar.terminate()
    clearInterval(interval)

    if (completed < total) {
        spinner(step).fail(step + '\n  ' +
            `${total - completed} 项内容未下载成功`)
    } else {
        spinner(step).succeed()
    }
}

const run = async () => {

    console.log(''.padEnd(strPaddingLength, strPaddingStr))
    console.log('')

    /************************************************
     * 确保内容存储目录和相关文件路径
     ***********************************************/
    {
        const step = '确保内容存储目录和相关文件路径'
        const waiting = spinner(step)
        await fs.ensureDir(dir.output)
        waiting.succeed()
    }

    /************************************************
     * 确定要处理的原始文件，并删除输出目录中多余的文件
     ***********************************************/
    {
        const step = '确定要处理的原始文件，并删除输出目录中多余的文件'
        const waiting = spinner(step)
        const src = Object.assign({}, files)
        const exist = Object.assign({}, files)
        const process = []
        for (const key in files) process.push(key)

        src.normal = await glob(path.resolve(dir.source, './*.png'))
        exist.normal = await glob(path.resolve(dir.output, './*.+(webp|jpg)'))
        src.blured = await glob(path.resolve(dir.source, './blured/*.png'))
        exist.blured = await glob(path.resolve(dir.output, './blured/*.+(webp|jpg)'))
        src.thumbnail = await glob(path.resolve(dir.source, './thumbnail/*.jpg'))
        exist.thumbnail = await glob(path.resolve(dir.output, './thumbnail/*.jpg'))

        for (const type of process) {
            const spare = exist[type].filter(fileExist => (
                src[type].every(file => (
                    path.basename(file, path.extname(file)) !==
                    path.basename(fileExist, path.extname(fileExist))
                ))
            ))
            files[type] = src[type].filter(fileExist => (
                exist[type].every(file => (
                    path.basename(file, path.extname(file)) !==
                    path.basename(fileExist, path.extname(fileExist))
                ))
            ))
            for (const file of spare) {
                await fs.remove(file)
            }
        }

        waiting.succeed()
    }

    /************************************************
     * 处理图片：标准
     ***********************************************/
    {
        const step = '处理图片：标准'
        if (files.normal.length)
            await process(
                step,
                files.normal,
                [
                    'webp:80',
                    'jpg:84'
                ]
            )
        else
            spinner(step)
                .succeed(step + ' (无新图)')
    }

    /************************************************
     * 处理图片：模糊
     ***********************************************/
    {
        const step = '处理图片：模糊'
        if (files.blured.length)
            await process(
                step,
                files.blured,
                [
                    'webp:90',
                    'jpg:84'
                ],
                'blured'
            )
        else
            spinner(step)
                .succeed(step + ' (无新图)')
    }

    /************************************************
     * 处理图片：缩略图
     ***********************************************/
    {
        const step = '处理图片：缩略图'
        if (files.thumbnail.length)
            await process(
                step,
                files.thumbnail,
                'jpg:84',
                'thumbnail'
            )
        else
            spinner(step)
                .succeed(step + ' (无新图)')
    }

    /************************************************
     * 复制图片：原图
     ***********************************************/
    {
        ncp.limit = 16
        const step = '复制图片：原图'
        const waiting = spinner(step)
        await new Promise((resolve, reject) => {
            ncp(
                path.resolve(dir.source, './original'),
                path.resolve(dir.output, './original'),
                function (err) {
                    if (err) return reject(err)
                    resolve()
                })
        })
        waiting.succeed()
    }

    console.log('')
    console.log(
        '\x1b[36m' + '完成! ' + '\x1b[0m'
        + ''.padEnd(strPaddingLength - 6, strPaddingStr)
    )
    console.log('')

}

run()