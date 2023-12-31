class Cell {
  static TERRAIN = 0;
  static OBSTACLE = 1;
  static SPAWN = 2;
  static GOAL = 3;
  static HOR_COST = 1;
  static DIAG_COST = Math.sqrt(2);

  constructor(x, y) {
    this.type = Cell.TERRAIN;
    this.x = x;
    this.y = y;
  }
}

class Unit {
  constructor(x, y, a = 0) {
    this.radius = 0.5;
    this.moveSpeed = 5;
    this.rotateSpeed = 90;
    this.angle = a;
    this.x = x;
    this.y = y;
    this.way = [];
  }
}

class World {
  cellSize = 1;
  meshHeight = 0;
  meshWidth = 0;

  meshMap = {};
  meshArr = [];

  unitsSet = new Set();

  interval = null;
  goal = null;

  constructor(cellSize, meshWidth, meshHeight) {
    this.cellSize = cellSize;
    this.meshWidth = meshWidth;
    this.meshHeight = meshHeight;
    console.log('World created!')
  }

  getAngle(angle) {
    return angle < 0 ? 360 + angle : angle % 360;
  }

  resetWays() {
    Array.from(this.unitsSet.values()).forEach((unit) => {
      unit.way = [];
    })
  }

  tick() {
    const now = Date.now();
    const time = now - this.time;
    this.time = now;
    if (!time) return;

    // create unit
    while (this.unitsSet.size < 50) {
      const spawn = this.spawns[Math.round(Math.random() * this.spawns.length - 1)];
      if (!spawn) return;
      const unit = new Unit(spawn.x, spawn.y, Math.round(Math.random() * 360));
      this.unitsSet.add(unit);
      console.log('Unit created!')
    }

    // move units
    for (let unit of this.unitsSet.values()) {
      const cell = this.cellAt(unit.x, unit.y);
      if (cell === unit.goal) {
        this.unitsSet.delete(unit);
        continue;
      }

      // check if has no stuck
      if (!unit.way.length) {
        unit.goal = this.goals[Math.round(Math.random() * this.goals.length - 1)];
        if (!unit.goal) return;
        unit.way = this.getWay(cell, unit.goal);
      }

      // move to next point on way
      const moveDist = (time / 1000) * unit.moveSpeed;
      let goalDist = 0;
      let goalX = 0;
      let goalY = 0;
      let next = null;
      while (next === null && unit.way[0]) {
        if (cell === unit.way[0]) {
          unit.way.shift();
          continue;
        }
        goalX = unit.way[0].x + this.cellSize / 2;
        goalY = unit.way[0].y + this.cellSize / 2;
        goalDist = Math.sqrt(Math.pow(unit.x - goalX, 2) + Math.pow(unit.y - goalY, 2));
        if (goalDist < this.cellSize * 2 && unit.way[1]) {
          unit.way.shift();
          continue;
        }
        next = unit.way[0];
      }

      if (next) {
        const goalAngle = this.getAngle(90 + Math.atan2(unit.x - goalX, unit.y - goalY) / (Math.PI / 180));
        const angleDiff = Math.abs(Math.min(goalAngle - unit.angle, 360 - goalAngle + unit.angle));
        if (angleDiff > 15) {
          const rotateAngle = (time / 1000) * unit.rotateSpeed;
          const rotateSide = unit.angle > goalAngle && angleDiff < 180 || unit.angle + 180 < goalAngle ? -1 : 1;
          unit.angle = this.getAngle(unit.angle + Math.min(rotateAngle, angleDiff) * rotateSide);
        }

        if (angleDiff < 50) {
          unit.x += moveDist * Math.cos(Math.PI / 180 * -unit.angle);
          unit.y += moveDist * Math.sin(Math.PI / 180 * -unit.angle);
        }
      }
    }
  }

  start() {
    if (!this.interval) {
      this.time = Date.now();
      this.interval = setInterval(() => this.tick(), 1000 / 40);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  createMesh() {
    this.meshMap = {};
    this.meshArr = [];
    let x = this.meshWidth;
    while (x--) {
      let y = this.meshHeight;
      while (y--) {
        const cell = new Cell(x, y);
        if (!this.meshMap[x]) this.meshMap[x] = {};
        this.meshMap[x][y] = cell;
        this.meshArr.push(cell);
      }
    }
  }

  updateJoints() {
    this.meshArr.forEach((cell) => {
      if (cell.type !== Cell.OBSTACLE) {
        const t = this.cellAt(cell.x, cell.y - 1);
        const tr = this.cellAt(cell.x + 1, cell.y - 1);
        const r = this.cellAt(cell.x + 1, cell.y);
        const rb = this.cellAt(cell.x + 1, cell.y + 1);
        const b = this.cellAt(cell.x, cell.y + 1);
        const bl = this.cellAt(cell.x - 1, cell.y + 1);
        const l = this.cellAt(cell.x - 1, cell.y);
        const lt = this.cellAt(cell.x - 1, cell.y - 1);

        cell.t = t && t.type !== Cell.OBSTACLE ? t : undefined;
        cell.tr = tr && tr.type !== Cell.OBSTACLE ? tr : undefined;
        cell.r = r && r.type !== Cell.OBSTACLE ? r : undefined;
        cell.rb = rb && rb.type !== Cell.OBSTACLE ? rb : undefined;
        cell.b = b && b.type !== Cell.OBSTACLE ? b : undefined;
        cell.bl = bl && bl.type !== Cell.OBSTACLE ? bl : undefined;
        cell.l = l && l.type !== Cell.OBSTACLE ? l : undefined;
        cell.lt = lt && lt.type !== Cell.OBSTACLE ? lt : undefined;
      } else {
        delete cell.t;
        delete cell.tr;
        delete cell.r;
        delete cell.rb;
        delete cell.b;
        delete cell.bl;
        delete cell.l;
        delete cell.lt;
      }
    });
  }

  spawns = [];
  goals = [];

  updateCosts() {
    this.spawns = [];
    this.goals = [];
    this.meshArr.forEach((cell) => {
      if (cell.type === Cell.SPAWN) this.spawns.push(cell);
      if (cell.type === Cell.GOAL) this.goals.push(cell);
      cell.cost = Cell.HOR_COST;
      cell.dcost = Cell.DIAG_COST;
      if (cell.type !== Cell.OBSTACLE) {
        if (
          !cell.t ||
          !cell.r ||
          !cell.b ||
          !cell.l ||
          !cell.tr ||
          !cell.rb ||
          !cell.bl ||
          !cell.lt
        ) {
          cell.cost *= 1.7;
          cell.dcost *= 1.7;
        }
      }
    });
  }

  cellAt(x, y) {
    x = Math.floor(x)
    y = Math.floor(y)
    return this.meshMap[x] && this.meshMap[x][y];
  }

  exportFormat = [,,'type'];

  exportMeshOptions() {
    const map = {};
    this.meshArr.forEach((cell) => {
      let shouldExport = false;
      let cellOptions = [cell.x, cell.y];
      this.exportFormat.forEach((prop, key) => {
        if (typeof prop === 'string' && cell[prop]) {
          cellOptions[key] = cell[prop] * 1;
          shouldExport = true;
        }
      })
      if (shouldExport) {
        if (!map[cell.x]) map[cell.x] = {};
        map[cell.x][cell.y] = cellOptions;
      }
    })
    return JSON.stringify(map);
  }

  importMeshOptions(json) {
    const data = JSON.parse(json);
    for (let x in data) {
      for (let y in data[x]) {
        const cellOptions = data[x][y];
        const cell = this.cellAt(x, y);
        this.exportFormat.forEach((prop, key) => {
          if (typeof prop === 'string') {
            if (cellOptions[key] !== undefined) {
              cell[prop] = cellOptions[key];
            }
          }
        });
      }
    }
  }

  getWay(from, to) {
    if (!to) return [];

    const queue = [];
    const prevs = new Map();
    const costs = new Map();

    const queueAdd = (cell, cost) => {
      const priority = cost + Math.abs(cell.x - to.x) + Math.abs(cell.y - to.y);
      queue.push([cell, priority]);
    };
    const queueGet = () => {
      return queue.length && queue.sort((a, b) => a[1] - b[1]).shift()[0];
    };

    costs.set(from, 0);
    queueAdd(from, 0);

    for (let cell; cell = queueGet();) {
      if (cell === to) break;

      const cost = costs.get(cell),
            nbs = [cell.t, cell.tr, cell.r, cell.rb, cell.b, cell.bl, cell.l, cell.lt];
      for (let i in nbs) {
        if (!nbs[i]) continue;
        const nb = nbs[i],
              nbCost = cost + (i % 2 ? nb.dcost : nb.cost),
              nbOldCost = costs.get(nb);
        if (nbOldCost !== undefined) {
          if (nbOldCost > nbCost) {
            costs.set(nb, nbCost);
            prevs.set(nb, cell);
          }
        } else {
          costs.set(nb, nbCost);
          prevs.set(nb, cell);
          queueAdd(nb, nbCost);
        }
      }
    }

    const way = [];
    if (prevs.has(to)) {
      let cell = to;
      while (cell) {
        way.push(cell);
        cell = prevs.get(cell);
      }
    }

    return way.reverse();
  }
}

class Camera {
  fps = 30;
  scale = 10;
  world;
  canvas;
  ctx;
  interval;

  drawTerrainDebug = false;
  drawWaysDebug = false;
  drawUnitsDebug = false;
  drawMeshDebug = false;

  constructor(world, canvas, scale, fps) {
    this.fps = fps;
    this.scale = scale;
    this.world = world;
    this.canvas = canvas;

    this.updateSize();
    console.log('Camera created!')
  }

  updateSize() {
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
    this.ctx = this.canvas.getContext('2d');
    this.cellSize = this.world.cellSize * this.scale;
    this.offsetX = this.canvas.width / 2 - this.world.meshWidth * this.cellSize / 2;
    this.offsetY = this.canvas.height / 2 - this.world.meshHeight * this.cellSize / 2;
  }

  frame() {
    this.clear();

    if (this.drawTerrainDebug) {
      const obstacles = [], spawns = [], goals = [], terrain = [];

      this.world.meshArr.forEach((cell) => {
        if (cell.type === Cell.OBSTACLE) obstacles.push(cell)
        if (cell.type === Cell.SPAWN) spawns.push(cell)
        if (cell.type === Cell.GOAL) goals.push(cell)
        if (cell.type === Cell.TERRAIN && cell.cost > 1) terrain.push(cell)
      });

      this.fillCells(obstacles, '#333');
      this.fillCells(terrain, '#ddd');
      this.fillCells(spawns, '#0f0');
      this.fillCells(goals, '#f00');
    }

    if (this.drawWaysDebug) {
      Array.from(this.world.unitsSet.values()).forEach((unit) => {
        this.fillCells(unit.way, 'rgba(255,0,255,0.5)');
      })
    }

    if (this.drawUnitsDebug) {
      this.drawUnits([...this.world.unitsSet], '#f00');
    }

    if (this.drawMeshDebug) {
      this.strokeCells(this.world.meshArr, 'rgba(0,0,0,0.05)');
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  fillCells(cells, color) {
    this.ctx.beginPath();
    cells.forEach((cell) => {
      const [x, y] = this.convertToCamera(cell.x, cell.y);
      this.ctx.rect(x, y, this.cellSize, this.cellSize);
    });
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawUnits(units, color) {
    units.forEach((unit) => {
      const [x, y] = this.convertToCamera(unit.x, unit.y);
      this.ctx.beginPath();
      this.ctx.arc(x, y, unit.radius * this.scale, 0, 2 * Math.PI - 1);
      this.ctx.fillStyle = color;
      this.ctx.fill();
      this.ctx.closePath();

      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      const vx = unit.radius * 2 * Math.cos(Math.PI / 180 * -unit.angle) * this.scale + x;
      const vy = unit.radius * 2 * Math.sin(Math.PI / 180 * -unit.angle) * this.scale + y;
      this.ctx.lineTo(vx, vy);
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = '#000';
      this.ctx.stroke();
      this.ctx.closePath();
    });
  }

  strokeCells(cells, color) {
    this.ctx.translate(-0.5, -0.5);
    this.ctx.beginPath();
    cells.forEach((cell) => {
      const [x, y] = this.convertToCamera(cell.x, cell.y);
      this.ctx.rect(x, y, this.cellSize, this.cellSize);
    });
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = color;
    this.ctx.stroke();
    this.ctx.translate(0.5, 0.5);
  }

  start() {
    if (!this.interval) {
      this.interval = setInterval(() => this.frame(), 1000 / this.fps);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  convertToCamera(x, y) {
    return [
      x * this.scale + this.offsetX,
      y * this.scale + this.offsetY,
    ];
  }

  convertToWorld(x, y) {
    return [
      (x - this.offsetX) / this.scale,
      (y - this.offsetY) / this.scale,
    ];
  }
}

class Controls {
  constructor(world, container) {
    this.world = world;
    this.container = container;
  }

  startMeshEditing(camera) {
    let cellType = 1;
    let interact = false;

    const setType = (x, y, erase) => {
      const [worldX, worldY] = camera.convertToWorld(x, y);
      const cell = this.world.cellAt(worldX, worldY);
      if (cell) {
        console.log(cell.x, cell.y)
        const type = erase ? 0 : cellType;
        if (cell.type !== type) {
          cell.type = type;


          world.updateJoints();
          world.updateCosts();
          world.resetWays();
          camera.frame();
        }
      }
    }

    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'Space') {
        ev.preventDefault();
        if (++cellType > 3) cellType = 1;
        console.log(`Cell type now: ${cellType}`);
      }
      if (ev.code === 'Enter') {
        ev.preventDefault();
        console.log(this.world.exportMeshOptions())
      }
    });

    window.addEventListener('mouseup', (ev) => {
      interact = false;
    });

    this.container.addEventListener('mousedown', (ev) => {
      interact = true;
      setType(ev.offsetX, ev.offsetY, ev.metaKey);
    });

    this.container.addEventListener('mousemove', (ev) => {
      interact && setType(ev.offsetX, ev.offsetY, ev.metaKey);
    })
  }
}

/**
 * Init world
 */

const world = new World(1, 70, 40);
world.createMesh();
world.importMeshOptions(
  '{"0":{"0":[0,0,1],"1":[0,1,1],"2":[0,2,1],"3":[0,3,1],"4":[0,4,1],"5":[0,5,1],"6":[0,6,1],"7":[0,7,1],"8":[0,8,1],"9":[0,9,1],"10":[0,10,1],"11":[0,11,1],"12":[0,12,1],"13":[0,13,1],"14":[0,14,1],"15":[0,15,1],"16":[0,16,1],"17":[0,17,1],"18":[0,18,1],"19":[0,19,1],"20":[0,20,1],"21":[0,21,1],"22":[0,22,1],"23":[0,23,1],"24":[0,24,1],"25":[0,25,1],"28":[0,28,3],"31":[0,31,1],"32":[0,32,1],"33":[0,33,1],"34":[0,34,1],"35":[0,35,1],"36":[0,36,1],"37":[0,37,1],"38":[0,38,1],"39":[0,39,1]},"1":{"0":[1,0,1],"1":[1,1,1],"2":[1,2,1],"3":[1,3,1],"4":[1,4,1],"5":[1,5,1],"6":[1,6,1],"7":[1,7,1],"8":[1,8,1],"9":[1,9,1],"10":[1,10,1],"11":[1,11,1],"12":[1,12,1],"13":[1,13,1],"14":[1,14,1],"15":[1,15,1],"16":[1,16,1],"17":[1,17,1],"18":[1,18,1],"19":[1,19,1],"20":[1,20,1],"21":[1,21,1],"22":[1,22,1],"23":[1,23,1],"24":[1,24,1],"25":[1,25,1],"31":[1,31,1],"32":[1,32,1],"33":[1,33,1],"34":[1,34,1],"35":[1,35,1],"36":[1,36,1],"37":[1,37,1],"38":[1,38,1],"39":[1,39,1]},"2":{"0":[2,0,1],"1":[2,1,1],"2":[2,2,1],"3":[2,3,1],"4":[2,4,1],"5":[2,5,1],"6":[2,6,1],"7":[2,7,1],"8":[2,8,1],"9":[2,9,1],"10":[2,10,1],"11":[2,11,1],"12":[2,12,1],"13":[2,13,1],"14":[2,14,1],"15":[2,15,1],"16":[2,16,1],"17":[2,17,1],"18":[2,18,1],"19":[2,19,1],"20":[2,20,1],"21":[2,21,1],"22":[2,22,1],"23":[2,23,1],"24":[2,24,1],"32":[2,32,1],"33":[2,33,1],"34":[2,34,1],"35":[2,35,1],"36":[2,36,1],"37":[2,37,1],"38":[2,38,1],"39":[2,39,1]},"3":{"0":[3,0,1],"1":[3,1,1],"2":[3,2,1],"3":[3,3,1],"4":[3,4,1],"5":[3,5,1],"6":[3,6,1],"7":[3,7,1],"8":[3,8,1],"9":[3,9,1],"10":[3,10,1],"11":[3,11,1],"12":[3,12,1],"13":[3,13,1],"14":[3,14,1],"15":[3,15,1],"16":[3,16,1],"17":[3,17,1],"18":[3,18,1],"19":[3,19,1],"20":[3,20,1],"21":[3,21,1],"22":[3,22,1],"23":[3,23,1],"32":[3,32,1],"33":[3,33,1],"34":[3,34,1],"35":[3,35,1],"36":[3,36,1],"37":[3,37,1],"38":[3,38,1],"39":[3,39,1]},"4":{"0":[4,0,1],"1":[4,1,1],"2":[4,2,1],"3":[4,3,1],"4":[4,4,1],"8":[4,8,1],"9":[4,9,1],"10":[4,10,1],"11":[4,11,1],"12":[4,12,1],"13":[4,13,1],"14":[4,14,1],"15":[4,15,1],"16":[4,16,1],"17":[4,17,1],"18":[4,18,1],"19":[4,19,1],"20":[4,20,1],"21":[4,21,1],"34":[4,34,1],"35":[4,35,1],"36":[4,36,1],"37":[4,37,1],"38":[4,38,1],"39":[4,39,1]},"5":{"0":[5,0,1],"1":[5,1,1],"2":[5,2,1],"9":[5,9,1],"10":[5,10,1],"11":[5,11,1],"12":[5,12,1],"13":[5,13,1],"14":[5,14,1],"15":[5,15,1],"16":[5,16,1],"17":[5,17,1],"18":[5,18,1],"19":[5,19,1],"20":[5,20,1],"35":[5,35,1],"36":[5,36,1],"37":[5,37,1],"38":[5,38,1],"39":[5,39,1]},"6":{"0":[6,0,1],"1":[6,1,1],"10":[6,10,1],"11":[6,11,1],"12":[6,12,1],"13":[6,13,1],"14":[6,14,1],"15":[6,15,1],"16":[6,16,1],"17":[6,17,1],"18":[6,18,1],"19":[6,19,1],"36":[6,36,1],"37":[6,37,1],"38":[6,38,1],"39":[6,39,1]},"7":{"0":[7,0,1],"1":[7,1,1],"10":[7,10,1],"11":[7,11,1],"12":[7,12,1],"13":[7,13,1],"14":[7,14,1],"15":[7,15,1],"16":[7,16,1],"17":[7,17,1],"18":[7,18,1],"36":[7,36,1],"37":[7,37,1],"38":[7,38,1],"39":[7,39,1]},"8":{"0":[8,0,1],"5":[8,5,2],"12":[8,12,1],"13":[8,13,1],"14":[8,14,1],"15":[8,15,1],"16":[8,16,1],"26":[8,26,1],"27":[8,27,1],"28":[8,28,1],"29":[8,29,1],"36":[8,36,1],"37":[8,37,1],"38":[8,38,1],"39":[8,39,1]},"9":{"0":[9,0,1],"24":[9,24,1],"25":[9,25,1],"26":[9,26,1],"27":[9,27,1],"28":[9,28,1],"29":[9,29,1],"36":[9,36,1],"37":[9,37,1],"38":[9,38,1],"39":[9,39,1]},"10":{"0":[10,0,1],"1":[10,1,1],"23":[10,23,1],"24":[10,24,1],"25":[10,25,1],"26":[10,26,1],"27":[10,27,1],"28":[10,28,1],"29":[10,29,1],"30":[10,30,1],"36":[10,36,1],"37":[10,37,1],"38":[10,38,1],"39":[10,39,1]},"11":{"0":[11,0,1],"1":[11,1,1],"23":[11,23,1],"24":[11,24,1],"25":[11,25,1],"26":[11,26,1],"27":[11,27,1],"28":[11,28,1],"29":[11,29,1],"30":[11,30,1],"36":[11,36,1],"37":[11,37,1],"38":[11,38,1],"39":[11,39,1]},"12":{"0":[12,0,1],"1":[12,1,1],"2":[12,2,1],"22":[12,22,1],"23":[12,23,1],"24":[12,24,1],"25":[12,25,1],"26":[12,26,1],"27":[12,27,1],"28":[12,28,1],"29":[12,29,1],"36":[12,36,1],"37":[12,37,1],"38":[12,38,1],"39":[12,39,1]},"13":{"0":[13,0,1],"1":[13,1,1],"2":[13,2,1],"21":[13,21,1],"22":[13,22,1],"23":[13,23,1],"24":[13,24,1],"25":[13,25,1],"26":[13,26,1],"27":[13,27,1],"28":[13,28,1],"29":[13,29,1],"36":[13,36,1],"37":[13,37,1],"38":[13,38,1],"39":[13,39,1]},"14":{"0":[14,0,1],"1":[14,1,1],"2":[14,2,1],"3":[14,3,1],"14":[14,14,1],"15":[14,15,1],"16":[14,16,1],"17":[14,17,1],"18":[14,18,1],"19":[14,19,1],"20":[14,20,1],"21":[14,21,1],"22":[14,22,1],"23":[14,23,1],"24":[14,24,1],"25":[14,25,1],"26":[14,26,1],"27":[14,27,1],"28":[14,28,1],"35":[14,35,1],"36":[14,36,1],"37":[14,37,1],"38":[14,38,1],"39":[14,39,1]},"15":{"0":[15,0,1],"1":[15,1,1],"2":[15,2,1],"3":[15,3,1],"12":[15,12,1],"13":[15,13,1],"14":[15,14,1],"15":[15,15,1],"16":[15,16,1],"17":[15,17,1],"18":[15,18,1],"19":[15,19,1],"20":[15,20,1],"21":[15,21,1],"22":[15,22,1],"23":[15,23,1],"24":[15,24,1],"35":[15,35,1],"36":[15,36,1],"37":[15,37,1],"38":[15,38,1],"39":[15,39,1]},"16":{"0":[16,0,1],"1":[16,1,1],"2":[16,2,1],"3":[16,3,1],"4":[16,4,1],"12":[16,12,1],"13":[16,13,1],"14":[16,14,1],"15":[16,15,1],"16":[16,16,1],"17":[16,17,1],"18":[16,18,1],"19":[16,19,1],"35":[16,35,1],"36":[16,36,1],"37":[16,37,1],"38":[16,38,1],"39":[16,39,1]},"17":{"0":[17,0,1],"1":[17,1,1],"2":[17,2,1],"3":[17,3,1],"4":[17,4,1],"5":[17,5,1],"6":[17,6,1],"12":[17,12,1],"13":[17,13,1],"14":[17,14,1],"15":[17,15,1],"16":[17,16,1],"17":[17,17,1],"34":[17,34,1],"35":[17,35,1],"36":[17,36,1],"37":[17,37,1],"38":[17,38,1],"39":[17,39,1]},"18":{"0":[18,0,1],"1":[18,1,1],"2":[18,2,1],"3":[18,3,1],"4":[18,4,1],"5":[18,5,1],"6":[18,6,1],"7":[18,7,1],"13":[18,13,1],"14":[18,14,1],"15":[18,15,1],"16":[18,16,1],"17":[18,17,1],"34":[18,34,1],"35":[18,35,1],"36":[18,36,1],"37":[18,37,1],"38":[18,38,1],"39":[18,39,1]},"19":{"0":[19,0,1],"1":[19,1,1],"2":[19,2,1],"3":[19,3,1],"4":[19,4,1],"5":[19,5,1],"6":[19,6,1],"7":[19,7,1],"13":[19,13,1],"14":[19,14,1],"15":[19,15,1],"16":[19,16,1],"17":[19,17,1],"29":[19,29,1],"30":[19,30,1],"31":[19,31,1],"32":[19,32,1],"33":[19,33,1],"34":[19,34,1],"35":[19,35,1],"36":[19,36,1],"37":[19,37,1],"38":[19,38,1],"39":[19,39,1]},"20":{"0":[20,0,1],"1":[20,1,1],"2":[20,2,1],"3":[20,3,1],"4":[20,4,1],"5":[20,5,1],"6":[20,6,1],"7":[20,7,1],"8":[20,8,1],"13":[20,13,1],"14":[20,14,1],"15":[20,15,1],"16":[20,16,1],"24":[20,24,1],"25":[20,25,1],"26":[20,26,1],"27":[20,27,1],"28":[20,28,1],"29":[20,29,1],"30":[20,30,1],"31":[20,31,1],"32":[20,32,1],"33":[20,33,1],"34":[20,34,1],"35":[20,35,1],"36":[20,36,1],"37":[20,37,1],"38":[20,38,1],"39":[20,39,1]},"21":{"0":[21,0,1],"1":[21,1,1],"2":[21,2,1],"3":[21,3,1],"4":[21,4,1],"5":[21,5,1],"6":[21,6,1],"7":[21,7,1],"8":[21,8,1],"13":[21,13,1],"14":[21,14,1],"15":[21,15,1],"16":[21,16,1],"23":[21,23,1],"24":[21,24,1],"25":[21,25,1],"26":[21,26,1],"27":[21,27,1],"28":[21,28,1],"29":[21,29,1],"30":[21,30,1],"31":[21,31,1],"32":[21,32,1],"33":[21,33,1],"34":[21,34,1],"35":[21,35,1],"36":[21,36,1],"37":[21,37,1],"38":[21,38,1],"39":[21,39,1]},"22":{"0":[22,0,1],"1":[22,1,1],"2":[22,2,1],"3":[22,3,1],"4":[22,4,1],"5":[22,5,1],"6":[22,6,1],"7":[22,7,1],"8":[22,8,1],"14":[22,14,1],"15":[22,15,1],"16":[22,16,1],"22":[22,22,1],"23":[22,23,1],"24":[22,24,1],"25":[22,25,1],"26":[22,26,1],"27":[22,27,1],"28":[22,28,1],"29":[22,29,1],"30":[22,30,1],"31":[22,31,1],"32":[22,32,1],"33":[22,33,1],"34":[22,34,1],"35":[22,35,1],"36":[22,36,1],"37":[22,37,1],"38":[22,38,1],"39":[22,39,1]},"23":{"0":[23,0,1],"1":[23,1,1],"2":[23,2,1],"3":[23,3,1],"4":[23,4,1],"5":[23,5,1],"6":[23,6,1],"7":[23,7,1],"8":[23,8,1],"14":[23,14,1],"15":[23,15,1],"16":[23,16,1],"22":[23,22,1],"23":[23,23,1],"24":[23,24,1],"25":[23,25,1],"26":[23,26,1],"27":[23,27,1],"28":[23,28,1],"29":[23,29,1],"30":[23,30,1],"31":[23,31,1],"32":[23,32,1],"33":[23,33,1],"34":[23,34,1],"35":[23,35,1],"36":[23,36,1],"37":[23,37,1],"38":[23,38,1],"39":[23,39,1]},"24":{"0":[24,0,1],"1":[24,1,1],"2":[24,2,1],"3":[24,3,1],"4":[24,4,1],"5":[24,5,1],"6":[24,6,1],"7":[24,7,1],"8":[24,8,1],"14":[24,14,1],"15":[24,15,1],"16":[24,16,1],"22":[24,22,1],"23":[24,23,1],"24":[24,24,1],"25":[24,25,1],"26":[24,26,1],"27":[24,27,1],"28":[24,28,1],"29":[24,29,1],"30":[24,30,1],"31":[24,31,1],"32":[24,32,1],"33":[24,33,1],"34":[24,34,1],"35":[24,35,1],"36":[24,36,1],"37":[24,37,1],"38":[24,38,1],"39":[24,39,1]},"25":{"0":[25,0,1],"1":[25,1,1],"2":[25,2,1],"3":[25,3,1],"4":[25,4,1],"5":[25,5,1],"6":[25,6,1],"7":[25,7,1],"8":[25,8,1],"14":[25,14,1],"15":[25,15,1],"16":[25,16,1],"22":[25,22,1],"23":[25,23,1],"24":[25,24,1],"25":[25,25,1],"26":[25,26,1],"27":[25,27,1],"28":[25,28,1],"29":[25,29,1],"30":[25,30,1],"31":[25,31,1],"32":[25,32,1],"33":[25,33,1],"34":[25,34,1],"35":[25,35,1],"36":[25,36,1],"37":[25,37,1],"38":[25,38,1],"39":[25,39,1]},"26":{"0":[26,0,1],"1":[26,1,1],"2":[26,2,1],"3":[26,3,1],"4":[26,4,1],"5":[26,5,1],"6":[26,6,1],"7":[26,7,1],"8":[26,8,1],"14":[26,14,1],"15":[26,15,1],"16":[26,16,1],"23":[26,23,1],"24":[26,24,1],"25":[26,25,1],"26":[26,26,1],"27":[26,27,1],"28":[26,28,1],"29":[26,29,1],"30":[26,30,1],"31":[26,31,1],"32":[26,32,1],"33":[26,33,1],"34":[26,34,1],"35":[26,35,1],"36":[26,36,1],"37":[26,37,1],"38":[26,38,1],"39":[26,39,1]},"27":{"0":[27,0,1],"1":[27,1,1],"2":[27,2,1],"3":[27,3,1],"4":[27,4,1],"5":[27,5,1],"6":[27,6,1],"7":[27,7,1],"8":[27,8,1],"14":[27,14,1],"15":[27,15,1],"16":[27,16,1],"24":[27,24,1],"25":[27,25,1],"32":[27,32,1],"33":[27,33,1],"34":[27,34,1],"35":[27,35,1],"36":[27,36,1],"37":[27,37,1],"38":[27,38,1],"39":[27,39,1]},"28":{"0":[28,0,1],"1":[28,1,1],"2":[28,2,1],"3":[28,3,1],"4":[28,4,1],"5":[28,5,1],"6":[28,6,1],"7":[28,7,1],"8":[28,8,1],"14":[28,14,1],"15":[28,15,1],"16":[28,16,1],"34":[28,34,1],"35":[28,35,1],"36":[28,36,1],"37":[28,37,1],"38":[28,38,1],"39":[28,39,1]},"29":{"0":[29,0,1],"1":[29,1,1],"2":[29,2,1],"3":[29,3,1],"4":[29,4,1],"5":[29,5,1],"6":[29,6,1],"7":[29,7,1],"8":[29,8,1],"14":[29,14,1],"15":[29,15,1],"16":[29,16,1],"17":[29,17,1],"35":[29,35,1],"36":[29,36,1],"37":[29,37,1],"38":[29,38,1],"39":[29,39,1]},"30":{"0":[30,0,1],"1":[30,1,1],"2":[30,2,1],"3":[30,3,1],"4":[30,4,1],"5":[30,5,1],"6":[30,6,1],"7":[30,7,1],"14":[30,14,1],"15":[30,15,1],"16":[30,16,1],"17":[30,17,1],"36":[30,36,1],"37":[30,37,1],"38":[30,38,1],"39":[30,39,1]},"31":{"0":[31,0,1],"1":[31,1,1],"2":[31,2,1],"3":[31,3,1],"4":[31,4,1],"5":[31,5,1],"6":[31,6,1],"7":[31,7,1],"14":[31,14,1],"15":[31,15,1],"16":[31,16,1],"17":[31,17,1],"18":[31,18,1],"37":[31,37,1],"38":[31,38,1],"39":[31,39,1]},"32":{"0":[32,0,1],"1":[32,1,1],"2":[32,2,1],"3":[32,3,1],"4":[32,4,1],"5":[32,5,1],"6":[32,6,1],"7":[32,7,1],"13":[32,13,1],"14":[32,14,1],"15":[32,15,1],"16":[32,16,1],"17":[32,17,1],"18":[32,18,1],"37":[32,37,1],"38":[32,38,1],"39":[32,39,1]},"33":{"0":[33,0,1],"1":[33,1,1],"2":[33,2,1],"3":[33,3,1],"4":[33,4,1],"5":[33,5,1],"6":[33,6,1],"13":[33,13,1],"14":[33,14,1],"15":[33,15,1],"16":[33,16,1],"17":[33,17,1],"18":[33,18,1],"19":[33,19,1],"20":[33,20,1],"28":[33,28,1],"29":[33,29,1],"38":[33,38,1],"39":[33,39,1]},"34":{"0":[34,0,1],"1":[34,1,1],"2":[34,2,1],"3":[34,3,1],"4":[34,4,1],"5":[34,5,1],"6":[34,6,1],"13":[34,13,1],"14":[34,14,1],"15":[34,15,1],"16":[34,16,1],"17":[34,17,1],"18":[34,18,1],"19":[34,19,1],"20":[34,20,1],"21":[34,21,1],"22":[34,22,1],"23":[34,23,1],"24":[34,24,1],"25":[34,25,1],"26":[34,26,1],"27":[34,27,1],"28":[34,28,1],"29":[34,29,1],"30":[34,30,1],"38":[34,38,1],"39":[34,39,1]},"35":{"0":[35,0,1],"1":[35,1,1],"2":[35,2,1],"3":[35,3,1],"4":[35,4,1],"13":[35,13,1],"14":[35,14,1],"15":[35,15,1],"16":[35,16,1],"17":[35,17,1],"18":[35,18,1],"19":[35,19,1],"20":[35,20,1],"21":[35,21,1],"22":[35,22,1],"23":[35,23,1],"24":[35,24,1],"25":[35,25,1],"26":[35,26,1],"27":[35,27,1],"28":[35,28,1],"29":[35,29,1],"30":[35,30,1],"38":[35,38,1],"39":[35,39,1]},"36":{"0":[36,0,1],"1":[36,1,1],"2":[36,2,1],"3":[36,3,1],"13":[36,13,1],"14":[36,14,1],"15":[36,15,1],"16":[36,16,1],"17":[36,17,1],"18":[36,18,1],"19":[36,19,1],"20":[36,20,1],"21":[36,21,1],"22":[36,22,1],"23":[36,23,1],"24":[36,24,1],"25":[36,25,1],"26":[36,26,1],"27":[36,27,1],"28":[36,28,1],"29":[36,29,1],"30":[36,30,1],"31":[36,31,1],"38":[36,38,1],"39":[36,39,1]},"37":{"0":[37,0,1],"1":[37,1,1],"2":[37,2,1],"13":[37,13,1],"14":[37,14,1],"15":[37,15,1],"16":[37,16,1],"17":[37,17,1],"18":[37,18,1],"19":[37,19,1],"20":[37,20,1],"27":[37,27,1],"28":[37,28,1],"29":[37,29,1],"30":[37,30,1],"31":[37,31,1],"38":[37,38,1],"39":[37,39,1]},"38":{"0":[38,0,1],"1":[38,1,1],"14":[38,14,1],"15":[38,15,1],"16":[38,16,1],"17":[38,17,1],"18":[38,18,1],"29":[38,29,1],"30":[38,30,1],"38":[38,38,1],"39":[38,39,1]},"39":{"0":[39,0,1],"1":[39,1,1],"15":[39,15,1],"16":[39,16,1],"17":[39,17,1],"38":[39,38,1],"39":[39,39,1]},"40":{"0":[40,0,1],"1":[40,1,1],"6":[40,6,2],"37":[40,37,1],"38":[40,38,1],"39":[40,39,1]},"41":{"0":[41,0,1],"1":[41,1,1],"37":[41,37,1],"38":[41,38,1],"39":[41,39,1]},"42":{"0":[42,0,1],"1":[42,1,1],"11":[42,11,1],"36":[42,36,1],"37":[42,37,1],"38":[42,38,1],"39":[42,39,1]},"43":{"0":[43,0,1],"1":[43,1,1],"2":[43,2,1],"10":[43,10,1],"11":[43,11,1],"12":[43,12,1],"23":[43,23,1],"24":[43,24,1],"25":[43,25,1],"35":[43,35,1],"36":[43,36,1],"37":[43,37,1],"38":[43,38,1],"39":[43,39,1]},"44":{"0":[44,0,1],"1":[44,1,1],"2":[44,2,1],"3":[44,3,1],"9":[44,9,1],"10":[44,10,1],"11":[44,11,1],"12":[44,12,1],"13":[44,13,1],"22":[44,22,1],"23":[44,23,1],"24":[44,24,1],"25":[44,25,1],"26":[44,26,1],"31":[44,31,1],"32":[44,32,1],"33":[44,33,1],"34":[44,34,1],"35":[44,35,1],"36":[44,36,1],"37":[44,37,1],"38":[44,38,1],"39":[44,39,1]},"45":{"0":[45,0,1],"1":[45,1,1],"2":[45,2,1],"3":[45,3,1],"4":[45,4,1],"5":[45,5,1],"6":[45,6,1],"7":[45,7,1],"8":[45,8,1],"9":[45,9,1],"10":[45,10,1],"11":[45,11,1],"12":[45,12,1],"13":[45,13,1],"22":[45,22,1],"23":[45,23,1],"24":[45,24,1],"25":[45,25,1],"26":[45,26,1],"27":[45,27,1],"28":[45,28,1],"29":[45,29,1],"30":[45,30,1],"31":[45,31,1],"32":[45,32,1],"33":[45,33,1],"34":[45,34,1],"35":[45,35,1],"36":[45,36,1],"37":[45,37,1],"38":[45,38,1],"39":[45,39,1]},"46":{"0":[46,0,1],"1":[46,1,1],"2":[46,2,1],"3":[46,3,1],"4":[46,4,1],"5":[46,5,1],"6":[46,6,1],"7":[46,7,1],"8":[46,8,1],"9":[46,9,1],"10":[46,10,1],"11":[46,11,1],"12":[46,12,1],"13":[46,13,1],"23":[46,23,1],"24":[46,24,1],"25":[46,25,1],"26":[46,26,1],"27":[46,27,1],"28":[46,28,1],"29":[46,29,1],"30":[46,30,1],"31":[46,31,1],"32":[46,32,1],"33":[46,33,1],"34":[46,34,1],"35":[46,35,1],"36":[46,36,1],"37":[46,37,1],"38":[46,38,1],"39":[46,39,1]},"47":{"0":[47,0,1],"1":[47,1,1],"2":[47,2,1],"3":[47,3,1],"4":[47,4,1],"5":[47,5,1],"6":[47,6,1],"7":[47,7,1],"8":[47,8,1],"9":[47,9,1],"10":[47,10,1],"11":[47,11,1],"12":[47,12,1],"24":[47,24,1],"25":[47,25,1],"26":[47,26,1],"27":[47,27,1],"28":[47,28,1],"29":[47,29,1],"30":[47,30,1],"31":[47,31,1],"32":[47,32,1],"33":[47,33,1],"34":[47,34,1],"35":[47,35,1],"36":[47,36,1],"37":[47,37,1],"38":[47,38,1],"39":[47,39,1]},"48":{"0":[48,0,1],"1":[48,1,1],"2":[48,2,1],"3":[48,3,1],"4":[48,4,1],"5":[48,5,1],"6":[48,6,1],"7":[48,7,1],"8":[48,8,1],"9":[48,9,1],"10":[48,10,1],"11":[48,11,1],"26":[48,26,1],"27":[48,27,1],"28":[48,28,1],"29":[48,29,1],"30":[48,30,1],"31":[48,31,1],"32":[48,32,1],"33":[48,33,1],"34":[48,34,1],"35":[48,35,1],"39":[48,39,1]},"49":{"0":[49,0,1],"1":[49,1,1],"2":[49,2,1],"3":[49,3,1],"4":[49,4,1],"5":[49,5,1],"6":[49,6,1],"7":[49,7,1],"8":[49,8,1],"9":[49,9,1],"27":[49,27,1],"28":[49,28,1],"29":[49,29,1],"30":[49,30,1],"31":[49,31,1],"32":[49,32,1],"33":[49,33,1],"34":[49,34,1]},"50":{"0":[50,0,1],"1":[50,1,1],"2":[50,2,1],"3":[50,3,1],"4":[50,4,1],"5":[50,5,1],"6":[50,6,1],"7":[50,7,1],"8":[50,8,1],"28":[50,28,1],"29":[50,29,1],"30":[50,30,1],"31":[50,31,1]},"51":{"0":[51,0,1],"1":[51,1,1],"2":[51,2,1],"3":[51,3,1],"4":[51,4,1],"5":[51,5,1],"6":[51,6,1],"7":[51,7,1],"8":[51,8,1],"28":[51,28,1],"29":[51,29,1],"30":[51,30,1],"39":[51,39,3]},"52":{"0":[52,0,1],"1":[52,1,1],"2":[52,2,1],"3":[52,3,1],"4":[52,4,1],"5":[52,5,1],"6":[52,6,1],"7":[52,7,1],"17":[52,17,1],"18":[52,18,1],"19":[52,19,1],"28":[52,28,1],"29":[52,29,1],"30":[52,30,1]},"53":{"0":[53,0,1],"1":[53,1,1],"2":[53,2,1],"3":[53,3,1],"4":[53,4,1],"5":[53,5,1],"6":[53,6,1],"7":[53,7,1],"15":[53,15,1],"16":[53,16,1],"17":[53,17,1],"18":[53,18,1],"19":[53,19,1],"20":[53,20,1],"28":[53,28,1],"29":[53,29,1],"30":[53,30,1]},"54":{"0":[54,0,1],"1":[54,1,1],"2":[54,2,1],"3":[54,3,1],"4":[54,4,1],"5":[54,5,1],"6":[54,6,1],"14":[54,14,1],"15":[54,15,1],"16":[54,16,1],"17":[54,17,1],"18":[54,18,1],"19":[54,19,1],"20":[54,20,1],"21":[54,21,1],"27":[54,27,1],"28":[54,28,1],"29":[54,29,1],"30":[54,30,1],"39":[54,39,1]},"55":{"0":[55,0,1],"1":[55,1,1],"2":[55,2,1],"3":[55,3,1],"4":[55,4,1],"5":[55,5,1],"6":[55,6,1],"13":[55,13,1],"14":[55,14,1],"15":[55,15,1],"16":[55,16,1],"17":[55,17,1],"18":[55,18,1],"19":[55,19,1],"20":[55,20,1],"21":[55,21,1],"27":[55,27,1],"28":[55,28,1],"29":[55,29,1],"30":[55,30,1],"31":[55,31,1],"38":[55,38,1],"39":[55,39,1]},"56":{"0":[56,0,1],"1":[56,1,1],"2":[56,2,1],"3":[56,3,1],"4":[56,4,1],"5":[56,5,1],"12":[56,12,1],"13":[56,13,1],"14":[56,14,1],"15":[56,15,1],"16":[56,16,1],"17":[56,17,1],"18":[56,18,1],"19":[56,19,1],"20":[56,20,1],"27":[56,27,1],"28":[56,28,1],"29":[56,29,1],"30":[56,30,1],"31":[56,31,1],"32":[56,32,1],"38":[56,38,1],"39":[56,39,1]},"57":{"0":[57,0,1],"1":[57,1,1],"2":[57,2,1],"3":[57,3,1],"4":[57,4,1],"12":[57,12,1],"13":[57,13,1],"14":[57,14,1],"15":[57,15,1],"16":[57,16,1],"17":[57,17,1],"18":[57,18,1],"19":[57,19,1],"20":[57,20,1],"26":[57,26,1],"27":[57,27,1],"28":[57,28,1],"29":[57,29,1],"30":[57,30,1],"31":[57,31,1],"32":[57,32,1],"38":[57,38,1],"39":[57,39,1]},"58":{"0":[58,0,1],"1":[58,1,1],"2":[58,2,1],"12":[58,12,1],"13":[58,13,1],"14":[58,14,1],"15":[58,15,1],"16":[58,16,1],"17":[58,17,1],"18":[58,18,1],"19":[58,19,1],"20":[58,20,1],"26":[58,26,1],"27":[58,27,1],"28":[58,28,1],"29":[58,29,1],"30":[58,30,1],"31":[58,31,1],"32":[58,32,1],"38":[58,38,1],"39":[58,39,1]},"59":{"0":[59,0,1],"1":[59,1,1],"12":[59,12,1],"13":[59,13,1],"14":[59,14,1],"15":[59,15,1],"16":[59,16,1],"17":[59,17,1],"18":[59,18,1],"19":[59,19,1],"26":[59,26,1],"27":[59,27,1],"28":[59,28,1],"29":[59,29,1],"30":[59,30,1],"31":[59,31,1],"38":[59,38,1],"39":[59,39,1]},"60":{"0":[60,0,1],"13":[60,13,1],"14":[60,14,1],"15":[60,15,1],"16":[60,16,1],"17":[60,17,1],"18":[60,18,1],"19":[60,19,1],"26":[60,26,1],"27":[60,27,1],"28":[60,28,1],"29":[60,29,1],"30":[60,30,1],"38":[60,38,1],"39":[60,39,1]},"61":{"14":[61,14,1],"15":[61,15,1],"16":[61,16,1],"17":[61,17,1],"18":[61,18,1],"19":[61,19,1],"27":[61,27,1],"28":[61,28,1],"29":[61,29,1],"37":[61,37,1],"38":[61,38,1],"39":[61,39,1]},"62":{"6":[62,6,1],"15":[62,15,1],"16":[62,16,1],"17":[62,17,1],"18":[62,18,1],"37":[62,37,1],"38":[62,38,1],"39":[62,39,1]},"63":{"0":[63,0,3],"5":[63,5,1],"6":[63,6,1],"7":[63,7,1],"36":[63,36,1],"37":[63,37,1],"38":[63,38,1],"39":[63,39,1]},"64":{"4":[64,4,1],"5":[64,5,1],"6":[64,6,1],"7":[64,7,1],"8":[64,8,1],"35":[64,35,1],"36":[64,36,1],"37":[64,37,1],"38":[64,38,1],"39":[64,39,1]},"65":{"2":[65,2,1],"3":[65,3,1],"4":[65,4,1],"5":[65,5,1],"6":[65,6,1],"7":[65,7,1],"8":[65,8,1],"9":[65,9,1],"34":[65,34,1],"35":[65,35,1],"36":[65,36,1],"37":[65,37,1],"38":[65,38,1],"39":[65,39,1]},"66":{"0":[66,0,1],"1":[66,1,1],"2":[66,2,1],"3":[66,3,1],"4":[66,4,1],"5":[66,5,1],"6":[66,6,1],"7":[66,7,1],"8":[66,8,1],"9":[66,9,1],"10":[66,10,1],"11":[66,11,1],"33":[66,33,1],"34":[66,34,1],"35":[66,35,1],"36":[66,36,1],"37":[66,37,1],"38":[66,38,1],"39":[66,39,1]},"67":{"0":[67,0,1],"1":[67,1,1],"2":[67,2,1],"3":[67,3,1],"4":[67,4,1],"5":[67,5,1],"6":[67,6,1],"7":[67,7,1],"8":[67,8,1],"9":[67,9,1],"10":[67,10,1],"11":[67,11,1],"12":[67,12,1],"13":[67,13,1],"14":[67,14,1],"31":[67,31,1],"32":[67,32,1],"33":[67,33,1],"34":[67,34,1],"35":[67,35,1],"36":[67,36,1],"37":[67,37,1],"38":[67,38,1],"39":[67,39,1]},"68":{"0":[68,0,1],"1":[68,1,1],"2":[68,2,1],"3":[68,3,1],"4":[68,4,1],"5":[68,5,1],"6":[68,6,1],"7":[68,7,1],"8":[68,8,1],"9":[68,9,1],"10":[68,10,1],"11":[68,11,1],"12":[68,12,1],"13":[68,13,1],"14":[68,14,1],"15":[68,15,1],"16":[68,16,1],"17":[68,17,1],"18":[68,18,1],"19":[68,19,1],"20":[68,20,1],"21":[68,21,1],"22":[68,22,1],"23":[68,23,1],"24":[68,24,1],"25":[68,25,1],"26":[68,26,1],"27":[68,27,1],"28":[68,28,1],"29":[68,29,1],"30":[68,30,1],"31":[68,31,1],"32":[68,32,1],"33":[68,33,1],"34":[68,34,1],"35":[68,35,1],"36":[68,36,1],"37":[68,37,1],"38":[68,38,1],"39":[68,39,1]},"69":{"0":[69,0,1],"1":[69,1,1],"2":[69,2,1],"3":[69,3,1],"4":[69,4,1],"5":[69,5,1],"6":[69,6,1],"7":[69,7,1],"8":[69,8,1],"9":[69,9,1],"10":[69,10,1],"11":[69,11,1],"12":[69,12,1],"13":[69,13,1],"14":[69,14,1],"15":[69,15,1],"16":[69,16,1],"17":[69,17,1],"18":[69,18,1],"19":[69,19,1],"20":[69,20,1],"21":[69,21,1],"22":[69,22,1],"23":[69,23,1],"24":[69,24,1],"25":[69,25,1],"26":[69,26,1],"27":[69,27,1],"28":[69,28,1],"29":[69,29,1],"30":[69,30,1],"31":[69,31,1],"32":[69,32,1],"33":[69,33,1],"34":[69,34,1],"35":[69,35,1],"36":[69,36,1],"37":[69,37,1],"38":[69,38,1],"39":[69,39,1]}}'
);
world.updateJoints();
world.updateCosts();

/**
 * Init camera
 */
const background = new Camera(world, window.background, 10, 30);
background.drawTerrainDebug = true;
background.frame();

const foreground = new Camera(world, window.foreground, 10, 30);
foreground.drawWaysDebug = true;
foreground.drawMeshDebug = true;
foreground.drawUnitsDebug = true;
foreground.start();

/**
 * Init controls
 */

const controls = new Controls(world, window.container);
controls.startMeshEditing(background);

/**
 * Init units
 */

world.start();
