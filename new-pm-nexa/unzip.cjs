const fs = require('fs');
const zlib = require('zlib');
const input = fs.createReadStream('webrtc_internals_dump.gz');
const output = fs.createWriteStream('webrtc_internals_dump.json');
input.pipe(zlib.createGunzip()).pipe(output).on('finish', () => console.log('Done'));
