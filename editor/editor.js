const params = new URL(window.location).searchParams;

const GRID_SIZE = 150;

function compareDistance(diffX, diffY, hypotenuse) {
  return Math.sign(diffX * diffX + diffY * diffY - hypotenuse * hypotenuse);
}

const camera = { x: 0, y: 0, scale: 0.5 };

function untranslate({x, y}) {
  return {
    x: x / camera.scale + camera.x,
    y: y / camera.scale + camera.y
  };
}
function toGrid({x, y}) {
  return `${Math.floor(x / GRID_SIZE)},${Math.floor(y / GRID_SIZE)}`;
}

const tiles = {};
let tileData;
class Tile {

  constructor({tile = 'stone-slabs', x = 0, y = 0, atBottom = false, data = null}) {
    const elem = document.createElement('div');
    elem.classList.add('tile');
    this.elem = elem;
    tilesWrapper.appendChild(elem);

    this.setTile(tile);
    this.setPos({x, y}, atBottom);
    this.data = data;
    this.selected = false;
  }

  setTile(tile) {
    this.tile = tile;
    this.elem.style.backgroundImage = `url(../tiles/${tileData[tile][0]})`;
  }

  setPos({x, y}, atBottom = false) {
    this.leavePos();

    this.pos = {x, y};
    this.id = `${x},${y}`;
    this.setExactPos(x * GRID_SIZE, y * GRID_SIZE);
    if (!tiles[this.id]) tiles[this.id] = [];
    if (atBottom) {
      this.position = 0;
      tiles[this.id].forEach(tile => tile.elem.style.zIndex = ++tile.position);
      tiles[this.id].splice(0, 0, this);
    } else {
      this.position = tiles[this.id].push(this) - 1;
    }
    this.elem.style.zIndex = this.position;
    if (this.selected) {
      selections[this.id] = true;
    }
  }

  setExactPos(x, y) {
    this.elem.style.transform = `translate(${x}px, ${y}px)`;
  }

  setSelect(selected) {
    if (selected === this.selected) return;
    this.selected = selected;
    if (selected) this.elem.classList.add('selected');
    else this.elem.classList.remove('selected');
  }

  leavePos() {
    if (this.id) {
      const index = tiles[this.id].indexOf(this);
      tiles[this.id].splice(index, 1);
      tiles[this.id].slice(index).forEach(tile => tile.elem.style.zIndex = --tile.position);
      if (!tiles[this.id].length) delete tiles[this.id];
      if (this.selected) {
        delete selections[this.id];
      }
      this.id = null;
      this.pos = null;
    }
  }

  remove() {
    this.leavePos();
    tilesWrapper.removeChild(this.elem);
    this.removed = true;
  }

  getData() {
    return {tile: this.tile, data: this.data};
  }

}

let tilesWrapper;

function paint() {
  tilesWrapper.style.transform = `scale(${camera.scale}) translate(${-camera.x}px, ${-camera.y}px)`;
  document.body.style.backgroundPosition = `${-(camera.x % GRID_SIZE) * camera.scale}px ${-(camera.y % GRID_SIZE) * camera.scale}px`;
  document.body.style.backgroundSize = GRID_SIZE * camera.scale + 'px';

  window.requestAnimationFrame(paint);
}

function isAcceptablePlacement(location, tile) { // alarmingly strict
  const id = toGrid(location);
  if (tileData[tile][2]) return tiles[id] && !tiles[id].find(t => t.tile === tile);
  else {
    if (tiles[id]) {
      tiles[id][0].remove();
    }
    return true;
  }
}
function placeTile({x, y}, changesObj = {}) {
  const id = toGrid({x, y});
  const changeEntry = tiles[id] ? tiles[id].map(t => t.getData()) : [];
  if (currentTile === 0) {
    if (tiles[id]) {
      [...tiles[id]].forEach(t => t.remove());
      changesObj[id] = changeEntry;
    }
  } else {
    const tileX = x / GRID_SIZE >> 0;
    const tileY = y / GRID_SIZE >> 0;
    if (isAcceptablePlacement({x, y}, currentTile)) {
      new Tile({tile: currentTile, x: tileX, y: tileY, atBottom: !tileData[currentTile][2]});
      changesObj[id] = changeEntry;
    }
  }
}

let mouseMode = null;
let currentTile = null;
let selections = null;
let undoHist = [], redoHist = [];
function deselectAll() {
  if (selections) {
    Object.keys(selections).forEach(id => {
      tiles[id].forEach(t => t.setSelect(false));
    });
    selections = null;
  }
}
function doMaker(inArray, outArray) {
  return () => {
    deselectAll();
    if (inArray.length) {
      const entry = inArray.pop();
      const newEntry = {};
      Object.keys(entry).map(id => {
        const newTileEntry = tiles[id] ? [...tiles[id]].map(t => (t.remove(), t.getData())) : [];
        newEntry[id] = newTileEntry;
        const newTiles = entry[id];
        if (!newTiles.length) return;
        const [x, y] = id.split(',').map(Number);
        newTiles.forEach(({tile, data}) => {
          new Tile({tile, data, x, y});
        });
      })
      outArray.push(newEntry);
    }
  };
}
const undo = doMaker(undoHist, redoHist);
const redo = doMaker(redoHist, undoHist);
function init([tileDataJSON]) {
  tileData = tileDataJSON;

  document.body.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${GRID_SIZE}' height='${GRID_SIZE}' fill='none' stroke='rgba(255,255,255,0.15)' stroke-width='2'%3E%3Cpath d='M0 0V${GRID_SIZE}H${GRID_SIZE}V0z'/%3E%3C/svg%3E")`;

  tilesWrapper = document.getElementById('tile-wrapper');

  document.addEventListener('mousedown', e => {
    if (!tilesWrapper.contains(e.target) && e.target !== document.body) return;
    if (!mouseMode) {
      const {x, y} = untranslate({x: e.clientX, y: e.clientY});
      const id = toGrid({x, y});
      if (e.which === 2) {
        if (tiles[id]) currentTile = tiles[id][tiles[id].length - 1].tile;
      } else if (e.shiftKey) {
        const deselecting = selections && selections[id];
        if (!selections) selections = {};
        const box = document.createElement('div');
        box.classList.add('selection-box');
        tilesWrapper.appendChild(box);
        mouseMode = {
          type: 'select',
          xInit: x,
          yInit: y,
          deselecting,
          box
        };
      } else if (currentTile === null || selections && !selections[id]) {
        mouseMode = {
          type: 'scroll',
          initMouseX: e.clientX,
          initMouseY: e.clientY,
          initCamX: camera.x,
          initCamY: camera.y,
          initCamScale: camera.scale
        };
      } else if (selections && selections[id]) {
        const changes = {};
        mouseMode = {
          type: 'drag',
          tiles: Object.keys(selections).map(id => {
            const obj = {
              xOffset: tiles[id][0].pos.x * GRID_SIZE - x,
              yOffset: tiles[id][0].pos.y * GRID_SIZE - y,
              tiles: [...tiles[id]]
            };
            changes[id] = tiles[id].map(t => t.getData());
            obj.tiles.forEach(tile => {
              tile.leavePos();
            });
            return obj;
          }),
          changes
        };
      } else {
        const changes = {};
        placeTile({x, y}, changes);
        mouseMode = {
          type: 'placing',
          placed: {[id]: true},
          changes
        };
      }
    }
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (mouseMode) {
      const {x, y} = untranslate({x: e.clientX, y: e.clientY});
      const id = toGrid({x, y});
      if (mouseMode.type === 'scroll') {
        const {initMouseX, initMouseY, initCamX, initCamY, initCamScale} = mouseMode;
        camera.x = initCamX + initMouseX / initCamScale - e.clientX / camera.scale;
        camera.y = initCamY + initMouseY / initCamScale - e.clientY / camera.scale;
      } else if (mouseMode.type === 'placing') {
        if (!mouseMode.placed[id]) {
          placeTile({x, y}, mouseMode.changes);
          mouseMode.placed[id] = true;
        }
      } else if (mouseMode.type === 'select') {
        const xMin = Math.min(x, mouseMode.xInit);
        const xMax = Math.max(x, mouseMode.xInit);
        const yMin = Math.min(y, mouseMode.yInit);
        const yMax = Math.max(y, mouseMode.yInit);
        mouseMode.box.style.left = xMin + 'px';
        mouseMode.box.style.top = yMin + 'px';
        mouseMode.box.style.width = xMax - xMin + 'px';
        mouseMode.box.style.height = yMax - yMin + 'px';
      } else if (mouseMode.type === 'drag') {
        mouseMode.tiles.forEach(({tiles, xOffset, yOffset}) => {
          tiles.forEach(tile => {
            tile.setExactPos(x + xOffset, y + yOffset);
          });
        });
      }
      e.preventDefault();
    }
  });
  document.addEventListener('mouseup', e => {
    if (mouseMode) {
      const {x, y} = untranslate({x: e.clientX, y: e.clientY});
      const id = toGrid({x, y});
      if (mouseMode.type === 'placing') {
        if (Object.keys(mouseMode.changes).length)
          undoHist.push(mouseMode.changes);
      } else if (mouseMode.type === 'select') {
        const xMin = Math.floor(Math.min(x, mouseMode.xInit) / GRID_SIZE);
        const xMax = Math.ceil(Math.max(x, mouseMode.xInit) / GRID_SIZE);
        const yMin = Math.floor(Math.min(y, mouseMode.yInit) / GRID_SIZE);
        const yMax = Math.ceil(Math.max(y, mouseMode.yInit) / GRID_SIZE);
        tilesWrapper.removeChild(mouseMode.box);
        let changed = 0;
        for (let x = xMin; x < xMax; x++) for (let y = yMin; y < yMax; y++) {
          const id = `${x},${y}`;
          if (tiles[id]) {
            if (mouseMode.deselecting) {
              tiles[id].forEach(t => t.setSelect(false));
              delete selections[id];
            } else {
              tiles[id].forEach(t => t.setSelect(true));
              selections[id] = true;
            }
            changed++;
          }
        }
        if (changed === 0) {
          deselectAll();
        }
      } else if (mouseMode.type === 'drag') {
        mouseMode.tiles.forEach(({tiles: tileStack, xOffset, yOffset}) => {
          const pos = {
            x: Math.round((x + xOffset) / GRID_SIZE),
            y: Math.round((y + yOffset) / GRID_SIZE)
          };
          const id = `${pos.x},${pos.y}`;
          if (!mouseMode.changes[id])
            mouseMode.changes[id] = tiles[id] ? tiles[id].map(t => t.getData()) : [];
          if (tiles[id]) [...tiles[id]].forEach(t => t.remove());
          tileStack.forEach(tile => {
            tile.setPos(pos);
          });
        });
        if (Object.keys(mouseMode.changes).length)
          undoHist.push(mouseMode.changes);
      }
      mouseMode = null;
      e.preventDefault();
    }
  });

  window.addEventListener('wheel', e => {
    if (!tilesWrapper.contains(e.target) && e.target !== document.body) return;
    if (e.ctrlKey || e.metaKey) {
      const change = Math.abs(e.deltaY / 1000) + 1;
      const oldScale = camera.scale;
      let xDiff = -camera.x * oldScale - e.clientX, yDiff = -camera.y * oldScale - e.clientY;
      if (e.deltaY > 0) {
        camera.scale /= change, xDiff /= change, yDiff /= change;
      } else if (e.deltaY < 0) {
        camera.scale *= change, xDiff *= change, yDiff *= change;
      }
      camera.x = -(e.clientX + xDiff) / camera.scale;
      camera.y = -(e.clientY + yDiff) / camera.scale;
      e.preventDefault();
    } else {
      camera.x += (e.shiftKey ? e.deltaY : e.deltaX) / camera.scale;
      camera.y += (e.shiftKey ? e.deltaX : e.deltaY) / camera.scale;
      if (e.deltaX) e.preventDefault();
    }
  });

  paint();
}

Promise.all([
  fetch('../tiles/tiledata.json').then(r => r.json()),
  new Promise(res => document.addEventListener('DOMContentLoaded', res, {once: true}))
]).then(init);
