import {
  version,
  author,
  description,
  icons,
  name,
  zip,
  doLog,
  bgColorDifference,
  weblink
} from "./config.json";
import { createCanvas, loadImage } from "canvas";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { parse, ParsedPath } from "path";
import JSZip from "jszip";

const info = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<resource author="${author}" description="${description}. Created using CyanMarine's auto moemon modder" name="${name}" version="${version}" weblink="${weblink}"/>`;

const unowns = "bcdefghijklmnopq";

type File = ParsedPath & { path: string };
type Files = { [name: string]: File };

function log(...a: any[]) {
  if (doLog) {
    console.log(...a);
  }
}

const files: Files = {};
readdirSync("./Sprites")
  .map((d) => parse(`./Sprites/${d}`))
  .filter((d) => d.ext != "")
  .forEach((d) => {
    files[d.name] = { ...d, path: `${d.dir}/${d.base}` };
  });

const unown: Files = {};
readdirSync("./Sprites/UnownSets")
  .map((d) => parse(`./Sprites/UnownSets/${d}`))
  .filter((d) => d.ext != "")
  .forEach((d) => {
    unown[d.name.split("-")[1]] = { ...d, path: `${d.dir}/${d.base}` };
  });

// log(unown);
// log(files);

rmSync("./output", { recursive: true, force: true });
mkdirSync("./output");
mkdirSync("./output/sprites");
mkdirSync("./output/sprites/battlesprites");
if (icons && !existsSync("./output/sprites/monstericons"))
  mkdirSync("./output/sprites/monstericons");

function cutSprites1(i: number) {
  log("Written sprite " + i);
  cut(i).then(() => {
    if (i < 649) cutSprites1(i + 1);
    else {
      cut("Egg", 650).then(() => {
        cutUnowns(0);
      });
    }
  });
}
cutSprites1(1);
function cutUnowns(i: number) {
  cut(652 + i, undefined, unown[unowns[i]]).then(() => {
    if (i < unowns.length - 1) cutUnowns(i + 1);
    else doIcons();
  });
}

const names = ["front-n", "front-s", "back-n", "back-s"];

async function cut(id: number | string, out = id, file = files[id]) {
  let canvas = createCanvas(64, 64);
  let ctx = canvas.getContext("2d");
  let image = await loadImage(file.path);
  let fun = (i: 0 | 1 | 2 | 3) => {
    ctx.drawImage(image, 64 * i, 0, 64, 64, 0, 0, 64, 64);
    let data = ctx.getImageData(0, 0, 64, 64);
    ctx.putImageData(removeBackground(data), 0, 0);
    writeFileSync(
      `./output/sprites/battlesprites/${out}-${names[i]}.png`,
      canvas.toBuffer("image/png")
    );
  };
  fun(0);
  fun(1);
  fun(2);
  fun(3);
}

function removeBackground(imageData: ImageData) {
  let data = imageData.data;
  let r = data[0];
  let g = data[1];
  let b = data[2];
  let a = data[3];

  for (let i = 0; i < data.length; i += 4) {
    if (
      bgColorDifference > 0
        ? getColorDifference(
            [r, g, b, a],
            [data[i], data[i + 1], data[i + 2], data[i + 3]]
          ) < bgColorDifference
        : data[i] == r &&
          data[i + 1] == g &&
          data[i + 2] == b &&
          data[i + 3] == a
    ) {
      data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
    }
  }

  return imageData;
}

type Color = [number, number, number, number?];

function getColorDifference(a: Color, b: Color) {
  let [ra, ga, ba, aa = 0] = a;
  let [rb, gb, bb, ab = 0] = b;

  let dr = rb - ra;
  let dg = ga - gb;
  let db = ba - bb;
  let da = aa - ab;

  return dr * dr + dg * dg + db * db + da * da;
}

function doIcons() {
  if (icons) {
    let cutIcon = async (id: number | string, out = id, file = files[id]) => {
      let oCanvas = createCanvas(64, 64);
      let canvas = createCanvas(36, 36);
      let oCtx = oCanvas.getContext("2d");
      let ctx = canvas.getContext("2d");
      let image = await loadImage(file.path);

      oCtx.drawImage(image, 0, 0, 64, 64, 0, 0, 64, 64);
      let data = oCtx.getImageData(0, 0, 64, 64);
      oCtx.putImageData(removeBackground(data), 0, 0);

      ctx.drawImage(oCanvas, 0, 0, 64, 64, 6, 10, 24, 24);

      writeFileSync(
        `./output/sprites/monstericons/${out}-0.png`,
        canvas.toBuffer("image/png")
      );
      log("Written icon " + out);
    };

    function iconPart1(i: number) {
      cutIcon(i).then(() => {
        if (i < 649) iconPart1(i + 1);
        else unownIcons(0);
      });
    }

    function unownIcons(i: number) {
      cutIcon(651 + i, undefined, unown[unowns[i]]).then(() => {
        if (i < unowns.length) unownIcons(i + 1);
        else doMeta();
      });
    }

    iconPart1(1);
  } else doMeta();
}

function doMeta() {
  writeFileSync("./output/info.xml", info);
  if (existsSync("./icon.png")) copyFileSync("./icon.png", "./output/icon.png");
  log("Written meta info");
  doZip();
}

function readDir(path: string) {
  return readdirSync(path)
    .map((d) => parse(path + `/${d}`))
    .map((d) => ({ ...d, path: `${d.dir}/${d.base}` }));
}

function doZip() {
  if (zip) {
    log("Zipping");
    let zipFile = new JSZip();
    let zipName = `${name.toLowerCase().replace(/\s/g, "_")}-${version}.mod`;

    if (existsSync(zipName)) rmSync(zipName);

    let fun = (path: string, zip: JSZip) => {
      readDir(path).forEach((d) => {
        if (d.ext) zip.file(d.base, readFileSync(d.path));
        else fun(d.path, zip.folder(d.base)!);
      });
    };
    fun("./output", zipFile);

    zipFile
      .generateAsync({ type: "base64" })
      .then((content) => {
        writeFileSync(zipName, content, {
          encoding: "base64",
        });
      })
      .then(() => {
        log("Finished");
      });
  }
}
