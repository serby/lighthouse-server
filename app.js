const express = require('express')
const app = express()
const spawn = require('child_process').spawn
const port = process.env.PORT || 3001
const host = process.env.HOST || 'localhost'
const apiKey = '158b7ff5745254e6ae5ad0ac5e56ab2b'


app.get('/', (req, res) => {
  const start = Date.now()
  const { key, url } = req.query

  if (key !== apiKey) return res.sendStatus(403)
  if (!url) return res.status(400).send('Missing url')
  const cmdStream = spawn(`${__dirname}/node_modules/.bin/lighthouse`, `--quiet --chrome-flags="--headless" --output-path=stdout ${url}`.split(' '))
  cmdStream.on('error', error => {
    console.error(error)
    res.sendStatus(500)
  })
  cmdStream.stderr.on('data', console.error)
  cmdStream.on('close', () => console.log(`URL ${url} complete in ${Date.now() - start}ms`))
  cmdStream.stdout.pipe(res)
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Listening on http://${host}:${port}`)
})
