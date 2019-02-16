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
    this.data = null;
  }

  setTile(tile) {
    this.tile = tile;
    this.elem.style.backgroundImage = `url(../tiles/${tileData[tile][0]})`;
  }

  setPos({x, y}, atBottom = false) {
    this.leavePos();

    this.id = `${x},${y}`;
    this.elem.style.transform = `translate(${x * GRID_SIZE}px, ${y * GRID_SIZE}px)`;
    if (!tiles[this.id]) tiles[this.id] = [];
    if (atBottom) {
      this.position = 0;
      tiles[this.id].forEach(tile => tile.elem.style.zIndex = ++tile.position);
      tiles[this.id].splice(0, 0, this);
    } else {
      this.position = tiles[this.id].push(this) - 1;
    }
    this.elem.style.zIndex = this.position;
  }

  leavePos() {
    if (this.id) {
      const index = tiles[this.id].indexOf(this);
      tiles[this.id].splice(index, 1);
      tiles[this.id].slice(index).forEach(tile => tile.elem.style.zIndex = --tile.position);
      if (!tiles[this.id].length) delete tiles[this.id];
      this.id = null;
    }
  }

  remove() {
    this.leavePos();
    tilesWrapper.removeChild(this.elem);
    this.removed = true;
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
function placeTile({x, y}) {
  if (currentTile === 0) {
    const id = toGrid({x, y});
    if (tiles[id]) [...tiles[id]].forEach(t => t.remove());
  } else {
    const tileX = x / GRID_SIZE >> 0;
    const tileY = y / GRID_SIZE >> 0;
    if (isAcceptablePlacement({x, y}, currentTile)) {
      new Tile({tile: currentTile, x: tileX, y: tileY, atBottom: !tileData[currentTile][2]});
    }
  }
}

let mouseMode = null;
let currentTile = null;
function init([tileDataJSON]) {
  tileData = tileDataJSON;

  document.body.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${GRID_SIZE}' height='${GRID_SIZE}' fill='none' stroke='rgba(255,255,255,0.15)' stroke-width='2'%3E%3Cpath d='M0 0V${GRID_SIZE}H${GRID_SIZE}V0z'/%3E%3C/svg%3E")`;

  tilesWrapper = document.getElementById('tile-wrapper');

  document.addEventListener('mousedown', e => {
    if (!tilesWrapper.contains(e.target) && e.target !== document.body) return;
    if (!mouseMode) {
      const {x, y} = untranslate({x: e.clientX, y: e.clientY});
      const id = toGrid({x, y});
      if (e.shiftKey) {
        //
      } else if (currentTile === null) {
        mouseMode = {
          type: 'scroll',
          initMouseX: e.clientX,
          initMouseY: e.clientY,
          initCamX: camera.x,
          initCamY: camera.y,
          initCamScale: camera.scale
        };
      } else {
        placeTile({x, y});
        mouseMode = {
          type: 'placing',
          placed: {[id]: true}
        }
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
          placeTile({x, y});
          mouseMode.placed[id] = true;
        }
      }
      e.preventDefault();
    }
  });
  document.addEventListener('mouseup', e => {
    if (mouseMode) {
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
