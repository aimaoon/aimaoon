import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { HERE, OUT, REPO } from './config.mjs'

/** 撮影からフォント取得、組版、書き出しまでを順番に流す。 */
const run = (file) => {
  console.log(`\n— ${file}`)
  execFileSync(process.execPath, [`${HERE}/${file}`], { stdio: 'inherit', cwd: REPO })
}

mkdirSync(OUT, { recursive: true })
run('screenshots.mjs')
run('font.mjs')
run('qr.mjs')
run('ads.mjs')
run('flyer.mjs')
run('landing.mjs')
run('render.mjs')
console.log(`\n出来上がり: ${OUT}`)
