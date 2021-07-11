const gulp = require('gulp');
const closure = require('google-closure-compiler').gulp();
const through2 = require('through2');

const COMMON = [
  '6502.js',
  'assert.js',
  'bits.js',
  'bits_array.js',
  'bits_base.js',
  'bits_bigint.js',
  'crc32.js',
  'asm/*.js',
  'data/*.js',
  'depgraph.js',
  'externs.js',
  'fetchreader.js',
  'flags/*.js',
  'flagset.js',
  'graph.js',
  'logic/*.js',
  'maze/*.js',
  'nodes.js',
  'pass/*.js',
  'patch.js',
  'polyfill.js',
  'random.js',
  'rom.js',
  'romimage.js',
  'rom/*.js',
  'spoiler/*.js',
  'unionfind.js',
  'util.js',
  'version.js',
];

const srcs = (...srcs) => srcs.map(s => './dist/js/' + s);

/**
 * `buildchr` will convert the files in `./patches/chr/*.chr` and
 * output a single `.ts` file for each `.chr` file. This ts file
 * contains a declaration for an ASCII representation of the tiles,
 * which can be used in the randomizer code to update a tile.
 * 
 * This task is not part of any other pipeline, it is intended to be
 * used as a one-off task, and the output is intended to be copy-pasted
 * into the other source files as needed.
 */
gulp.task('buildchr', function() {
  return gulp.src('./patches/chr/*.chr')
      .pipe(through2.obj((file, _, cb) => {
        let out = '';
        if (file.isBuffer()) {
          let start = 0;
          while (start * 0x10 < file.contents.length) {
            let data = file.contents.slice(start * 0x10, start * 0x10 + 0x10);
            let arr = new Array(64).fill(0);
            for (let x = 0; x < 8; ++x) {
              for (let y = 0; y < 8; ++y) {
                arr[x + y * 8] |= (data[y | 8] >> (~x & 7) & 1) << 1 | (data[y] >> (~x & 7) & 1);
              }
            }
            let concatted = arr
              .map((num) => { switch (num) {
                default:
                case 0: return '.'
                case 1: return '+'
                case 2: return 'x'
                case 3: return 'o'
              }})
              .join('')
              .match(/.{1,8}/g)
              .join('\n  ');
              
            
            const tile_as_hex = Number(start).toString(16).padStart(2, '0')
            out += `public static readonly ${file.stem}_tile${tile_as_hex} = parsePattern(\`\n  ${concatted}\n\`);\n`;
            ++start;
          }
        }
        file.contents = Buffer.from(out, 'utf8');
        file.basename = file.stem + ".ts";
        cb(null, file);
      }))
      .pipe(gulp.dest('./patches/chr/'));
});

gulp.task('main', function() {
  return gulp.src(srcs(...COMMON,
                       //'fetchreader.js',
                       'progress.js',
                       'render.js',
                       'main.js'),
                  {base: './dist/js/'})
      .pipe(closure({
        compilation_level: 'SIMPLE',
        warning_level: 'VERBOSE',
        language_in: 'ECMASCRIPT_2018',
        language_out: 'ECMASCRIPT6_STRICT',
        isolation_mode: 'IIFE',
        //output_wrapper: '(function(){\nconst global=window;%output%\n}).call(this)',
        js_output_file: 'main.min.js',
        module_resolution: 'WEBPACK',
      }, {
        platform: ['native', 'java', 'javascript'],
      }))
      .pipe(gulp.dest('./dist'));
});

gulp.task('check', function() {
  return gulp.src(srcs('check.js'), {base: './dist/'})
      .pipe(closure({
        compilation_level: 'SIMPLE',
        warning_level: 'VERBOSE',
        language_in: 'ECMASCRIPT_2018',
        language_out: 'ECMASCRIPT6_STRICT',
        isolation_mode: 'IIFE',
        //output_wrapper: '(function(){\nconst global=window;%output%\n}).call(this)',
        js_output_file: 'check.min.js',
        module_resolution: 'WEBPACK',
      }, {
        platform: ['native', 'java', 'javascript'],
      }))
      .pipe(gulp.dest('./dist'));
});

gulp.task('tracker', function() {
  return gulp.src(srcs(...COMMON, 'tracker.js'), {base: './dist/'})
      .pipe(closure({
        compilation_level: 'SIMPLE',
        warning_level: 'VERBOSE',
        language_in: 'ECMASCRIPT_2018',
        language_out: 'ECMASCRIPT6_STRICT',
        isolation_mode: 'IIFE',
        //output_wrapper: '(function(){\nconst global=window;%output%\n}).call(this)',
        js_output_file: 'tracker.min.js',
        module_resolution: 'WEBPACK',
      }, {
        platform: ['native', 'java', 'javascript'],
      }))
      .pipe(gulp.dest('./dist'));
});

gulp.task('edit', function() {
  return gulp.src(srcs(...COMMON, 'edit/*.js'),
                  {base: './dist/js/'})
      .pipe(closure({
        compilation_level: 'SIMPLE',
        warning_level: 'VERBOSE',
        language_in: 'ECMASCRIPT_2018',
        language_out: 'ECMASCRIPT6_STRICT',
        isolation_mode: 'IIFE',
        //output_wrapper: '(function(){\nconst global=window;%output%\n}).call(this)',
        js_output_file: 'edit.min.js',
        module_resolution: 'WEBPACK',
      }, {
        platform: ['native', 'java', 'javascript'],
      }))
      .pipe(gulp.dest('./dist'));
});

// TODO - build the modified HTML files here, too?
gulp.task('default', gulp.parallel('main', 'check', 'tracker'));
