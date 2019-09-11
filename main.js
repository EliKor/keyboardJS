function createFreqTable() {
  var freqTable = [];
  for (var n = 1; n < 77; n++) {
    var octave = ~~((n + 8) / 12);
    var noteVal = (n - 1) % 12;
    var freq = Math.pow(2, ((n + 12) - 49) / 12) * 440.0;
    freqTable[n - 1] = freq;
  }
  return freqTable;
}

///////////////// Global Variables ////////////////////

// Canvas Variables
var canvas = document.querySelector('.myCanvas');
var width = canvas.width = window.innerWidth;
var height = canvas.height = window.innerHeight;
var ctx = canvas.getContext("2d");

// Keyboard Variables
let noteVals = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
let keyCount = 76;
var activeNotes = new Array(keyCount);
var stoppedNotes = [];

var octave = 2;

var map = new Map();

// Audio Variables
let audioContext = new (window.audioContext || window.webkitAudioContext);
let freqTable = createFreqTable();

var compressor = audioContext.createDynamicsCompressor();
compressor.threshold.setValueAtTime(-100, audioContext.currentTime);
compressor.knee.setValueAtTime(40, audioContext.currentTime);
compressor.ratio.setValueAtTime(20, audioContext.currentTime);
compressor.attack.setValueAtTime(0, audioContext.currentTime);
compressor.release.setValueAtTime(0.25, audioContext.currentTime);
compressor.connect(audioContext.destination);

var masterGainNode = audioContext.createGain();
masterGainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
masterGainNode.connect(compressor);


//////////////// Rectangle ////////////////

function Rectangle(x, y, velY, color, width, height, stroke) {
  this.x = x;
  this.y = y;
  this.velY = velY;
  this.color = color;
  this.width = width;
  this.height = height;
  this.stroke = stroke;
}
Rectangle.prototype.draw = function () {
  if (this.y > height) { return false; }
  ctx.fillStyle = this.color;
  if (this.stroke) {
    ctx.strokeStyle = 'rgb(0, 0, 0)';
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
  else {
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
  return true;
}
Rectangle.prototype.update = function () {
  this.y += this.velY;
}
Rectangle.prototype.getOutOfBounds = function () {
  return this.outOfBounds;
}
Rectangle.prototype.contains = function (x, y) {
  if (x >= this.x && x <= this.x + this.width
    && y >= this.y && y <= this.y + this.height) {
    return true;
  }
  return false;
}


////////////////// Keyboard //////////////////

function buildKeyboard(whiteKeys, blackKeys) {
  let whiteWidth = width / 45;
  let whiteHeight = whiteWidth * 3.5;
  let blackWidth = whiteWidth * .66;
  let blackHeight = whiteHeight * .66;
  var x = 0;
  for (var i = 0; i < 45; i++) {
    whiteKeys.push(
      new Rectangle(x, height - whiteHeight, 0, 'rgb(255, 255, 255)',
        whiteWidth, whiteHeight, stroke = true)
    );
    x += whiteWidth;
  }
  x = whiteWidth * .66;
  var count = 2;
  var twoBlack = false;
  for (var i = 0; i < 31; i++) {
    blackKeys.push(
      new Rectangle(x, height - whiteHeight, 0, 'rgb(0, 0, 0)',
        blackWidth, blackHeight, stroke = false)
    );
    count += 1;
    if (count == 3 || count == 2 && twoBlack) {
      x += 2 * whiteWidth;
      twoBlack = !twoBlack;
      count = 0;
    }
    else {
      x += whiteWidth;
    }
  }
}

function Keyboard() {
  this.whiteKeys = [];
  this.blackKeys = [];
  buildKeyboard(this.whiteKeys, this.blackKeys);
  this.allKeys = [];
  black = 0;
  white = 0;
  for (var i = 0; i < 76; i++) {
    if (noteVals[i % 12].length > 1) {
      this.allKeys[i] = this.blackKeys[black];
      black++;
    }
    else {
      this.allKeys[i] = this.whiteKeys[white];
      white++;
    }
  }
}

Keyboard.prototype.draw = function () {
  for (var i = 0; i < this.whiteKeys.length; i++) {
    this.whiteKeys[i].draw();
  }
  for (var i = 0; i < this.blackKeys.length; i++) {
    this.blackKeys[i].draw();
  }
}

Keyboard.prototype.findKey = function (e) {
  keys = []
  for (var i = 0; i < this.allKeys.length; i++) {
    if (this.allKeys[i].contains(e.clientX, e.clientY)) {
      keys.push(i);
    }
  }
  if (keys.length > 1) {
    return this.allKeys[keys[0]].color == 'rgb(0, 0, 0)' ? keys[0] : keys[1];
  }
  else if (keys.length == 1) {
    return keys[0];
  }
  return -1;
}

keyboard = new Keyboard();


///////////// Note ///////////////

function Note(key) {
  this.gainNode = audioContext.createGain();
  this.gainNode.connect(masterGainNode);
  this.gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  this.osc = audioContext.createOscillator();
  this.osc.connect(this.gainNode);
  let freq = freqTable[key];
  this.osc.frequency.value = freq;
  this.osc.start();
  this.gainNode.gain.setTargetAtTime(1, audioContext.currentTime, 0.1);
}

function startNote(key) {
  if (noteVals[key % 12].length > 1) {
    keyboard.allKeys[key].color = 'rgb(81, 81, 81)';
  }
  else {
    keyboard.allKeys[key].color = 'rgb(211, 211, 211)';
  }
  activeNotes[key] = new Note(key);
}

function stopNote(key) {
  // Thanks to Aleman Gui for how to stop the clicking: 
  // http://alemangui.github.io/blog//2015/12/26/ramp-to-value.html
  activeNotes[key].gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.015);
  stoppedNotes.push(key);
  if (noteVals[key % 12].length > 1) {
    keyboard.allKeys[key].color = 'rgb(0, 0, 0)';
  }
  else {
    keyboard.allKeys[key].color = 'rgb(255, 255, 255)';
  }
}

function toggleNote(keyCode, down) {
  var key = 12 * octave;
  switch (keyCode) {
    case 65:
    case 97: // 'A' = 'C'
      key += 3;
      break;
    case 87:
    case 119: // 'W' = 'C#'
      key += 4;
      break;
    case 83:
    case 115: // 'S' = 'D'
      key += 5;
      break;
    case 69:
    case 101: // 'E' = 'D#'
      key += 6;
      break;
    case 68:
    case 100: // 'D' = 'E'
      key += 7;
      break;
    case 70:
    case 102: // 'F' = 'F'
      key += 8;
      break;
    case 84:
    case 116: // 'T' = 'F#'
      key += 9;
      break;
    case 71:
    case 103: // 'G' = 'G'
      key += 10;
      break;
    case 89:
    case 121: // 'Y' = 'G#'
      key += 11;
      break;
    case 72:
    case 104: // 'H' = 'A'
      key += 12;
      break;
    case 85:
    case 117: // 'U' = 'A#'
      key += 13;
      break;
    case 74:
    case 106: // 'J' = 'B'
      key += 14;
      break;
    case 75:
    case 107: // 'K' = 'C'
      key += 15;
      break;
    case 79:
    case 111: // 'O' = 'C#'
      if (octave < 5) key += 16;
      else return;
      break;
    case 76:
    case 108: // 'L' = 'D'
      if (octave < 5) key += 17;
      else return;
      break;
    case 90:
    case 122:
      if (down) {
        octave -= 1;
        octave = Math.max(0, octave);
      }
      return;
    case 88:
    case 120:
      if (down) {
        octave += 1;
        octave = Math.min(5, octave);
      }
      return;
    default:
      return;
  }
  if (key < 0 || key > 75) return;
  if (down && !map.has(keyCode)) {
    map.set(keyCode, 0);
    startNote(key);
  }
  else if (!down) {
    map.delete(keyCode);
    stopNote(key);
  }
}

//////////// Event Listeners //////////////
var clickedKey;
canvas.addEventListener("mousedown", (e) => {
  clickedKey = keyboard.findKey(e);
  if (clickedKey != -1) startNote(clickedKey);
});

canvas.addEventListener("mouseup", (e) => {
  if (clickedKey != -1) stopNote(clickedKey);
  clickedKey = -1;
});

document.addEventListener("keydown", (e) => { toggleNote(e.keyCode, true) });
document.addEventListener("keyup", (e) => { toggleNote(e.keyCode, false) });


///////// Animation Loop //////////////

function loop() {
  ctx.fillStyle = 'rgb(0, 0, 0)';
  ctx.fillRect(0, 0, width, height);
  keyboard.draw();
  for (var i = stoppedNotes.length - 1; i >= 0; i--) {
    var key = stoppedNotes[i];
    if (activeNotes[key].gainNode.gain < 0.015) {
      activeNotes[key].osc.stop();
      activeNotes[key] = null;
      stoppedNotes.splice(i);
    }
  }
  requestAnimationFrame(loop);
}

loop();

