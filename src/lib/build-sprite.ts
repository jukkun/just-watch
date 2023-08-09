import { glob } from 'glob'
import { parse } from 'node-html-parser'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'

const cwd = process.cwd()

const inputDir = path.join(cwd, 'src', 'assets', 'icons')
const inputDirRelative = path.relative(cwd, inputDir)

const outputDir = path.join(cwd, 'public')
const outputDirRelative = path.relative(cwd, outputDir)

const files = glob
	.sync('**/*.svg', {
		cwd: inputDir
	})
	.sort((a, b) => a.localeCompare(b))

if (files.length === 0) {
	console.log(`No SVG files found in ${inputDirRelative}`)
	process.exit(0)
}

// The relative paths are just for cleaner logs
console.log(`Generating sprite for ${inputDirRelative}`)

const spritesheetContent = await generateSvgSprite({
	files,
	inputDir
})

await writeIfChanged(path.join(outputDir, 'sprite.svg'), spritesheetContent)

console.log(`✅ Generated sprite.svg at ${outputDirRelative}`)

/**
 * Outputs an SVG string with all the icons as symbols
 */
async function generateSvgSprite({
	files,
	inputDir
}: {
	files: string[]
	inputDir: string
}) {
	// Each SVG becomes a symbol and we wrap them all in a single SVG
	const symbols = await Promise.all(
		files.map(async (file) => {
			const input = await fs.readFile(path.join(inputDir, file), 'utf8')
			const root = parse(input)
			const svg = root.querySelector('svg')
			if (!svg) throw new Error('No SVG element found')
			svg.tagName = 'symbol'
			svg.setAttribute('id', file.replace(/\.svg$/, ''))
			svg.removeAttribute('xmlns')
			svg.removeAttribute('xmlns:xlink')
			svg.removeAttribute('version')
			svg.removeAttribute('width')
			svg.removeAttribute('height')
			return svg.toString().trim()
		})
	)

	return [
		`<?xml version='1.0' encoding='UTF-8'?>`,
		`<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='0' height='0'>`,
		'<defs>', // for semantics: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/defs
		...symbols,
		'</defs>',
		'</svg>'
	].join('\n')
}

const typesContent = await generateTypes({
	names: files.map((file) => JSON.stringify(file.replace(/\.svg$/, '')))
})

await writeIfChanged(path.join(cwd, 'src', 'lib', 'names.ts'), typesContent)

async function generateTypes({
	names
}: {
	names: string[]
}) {
	return [
		'// This file is generated by pnpm run build:icons',
		'',
		'export type IconName =',
		...names.map((name) => `\t| ${name}`),
		''
	].join('\n')
}

/**
 * Each write can trigger dev server reloads
 * so only write if the content has changed
 */
async function writeIfChanged(filepath: string, newContent: string) {
	const currentContent = await fs.readFile(filepath, 'utf8')
	if (currentContent !== newContent) {
		return fs.writeFile(filepath, newContent, 'utf8')
	}
}
