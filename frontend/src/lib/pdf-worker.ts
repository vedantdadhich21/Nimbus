// Entry point for pdf.js's worker. The polyfill has to run in the worker's own
// global scope, because that is where the hex helpers are used while parsing.
import './bytes-polyfill'
import 'pdfjs-dist/build/pdf.worker.min.mjs'
