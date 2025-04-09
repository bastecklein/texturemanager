import { hash } from "common-helpers";

let imageAssets = {};
    
let tileSize = 0;
let renderScaleFactor = 1;
let hardTileSize = 0;

let defImageDirectory = "";

let useWidthInstead = false;

let geom = {};

let d3_geom_contourDx = [1, 0, 1, 1,-1, 0,-1, 1,0, 0,0,0,-1, 0,-1,NaN], 
    d3_geom_contourDy = [0,-1, 0, 0, 0,-1, 0, 0,1,-1,1,1, 0,-1, 0,NaN];

export function initAssets() {
    imageAssets = {};
}

export function setTileSize(size) {
    tileSize = size;
    initAssets();
}

export function setScaleFactor(factor) {
    renderScaleFactor = factor;
    initAssets();
}

export function getAsset(img, frame = 0, color = "def", flipped = false, custTileSize = tileSize, outlineWidth = 0, outlineColor = "#000000", withData = null, scale = 1) {
    if (!img) {
        return null;
    }

    let flippedString = flipped ? "flip" : "noflip";

    const imgObj = getImgObj(img, color, outlineColor, outlineWidth, flippedString, scale, custTileSize);

    if (imgObj.loading) {
        if (imgObj.init) {
            return null;
        }
    } else {
        if (frame >= imgObj.frames.length) {
            frame = 0;
        }
        return imgObj.frames[frame];
    }

    let useSrc = img;

    imgObj.init = true;

    if (img.indexOf("http:") === -1 && img.indexOf("https:") === -1 && img.indexOf("data:") === -1) {
        useSrc = defImageDirectory + img;
        if (withData && withData.indexOf("data:") === 0) {
            useSrc = withData;
        }
    }

    let issvg = img.toLowerCase().endsWith(".svg");

    if (color === "def") {
        issvg = false;
    }

    if (withData && withData.toLowerCase().indexOf("<?xml") === 0) {
        issvg = true;
        processLoadedSvgText(withData, imgObj);
        return null;
    }

    if (issvg) {
        fetch(useSrc).then(async response => {
            const svgAsString = await response.text();
            processLoadedSvgText(svgAsString, imgObj);
        });
    } else {
        const preImage = new Image();
        if (useSrc.indexOf("http:") === 0 || useSrc.indexOf("https:") === 0 || useSrc.indexOf("data:") === 0) {
            preImage.crossOrigin = "anonymous";
        }
        preImage.addEventListener("load", () => frameizeImage(preImage, imgObj));
        preImage.addEventListener("error", e => handleImageError(e, imgObj));
        preImage.src = useSrc;
    }

    return null;
}

export function preloadAsset(img, frame = 0, color = "def", flipped = false, custTileSize = tileSize, outlineWidth = 0, outlineColor = "#000000", withData = null, scale = 1) {
    if(!img) {
        return;
    }

    let flippedString = "noflip";

    if(flipped) {
        flippedString = "flip";
    }

    const imgObj = getImgObj(img, color, outlineColor, outlineWidth, flippedString, scale);

    if(imgObj.loading) {
        if(!imgObj.init) {
            getAsset(img, frame, color, flipped, custTileSize, outlineWidth, outlineColor, withData, scale);
        }
        
    }
}

export function setDefaultImageDirectory(dir) {
    defImageDirectory = dir;
}

export function getFrameCount(img, color = "def", flipped = false, outlineWidth = 0, outlineColor = "#000000", scale = 1, custTileSize = tileSize) {
    if(!img) {
        return 0;
    }

    let flippedString = "noflip";

    if(flipped) {
        flippedString = "flip";
    }

    const imgObj = getImgObj(img, color, outlineColor, outlineWidth, flippedString, scale, custTileSize);

    if(imgObj) {
        if(imgObj.loading) {
            return 0;
        } else {
            return imgObj.frames.length;
        }
    }

    return 0;
}

export function setHardTileSize(size) {
    hardTileSize = size;
    initAssets();
}

export function getAssetWithOptions(options) {
    let img = options.img || null;
    let frame = options.frame || 0;
    let color = options.color || "def";
    let flipped = options.flipped || false;
    let custTileSize = options.custTileSize || tileSize;
    let outlineWidth = options.outlineWidth || 0;
    let outlineColor = options.outlineColor || "#000000";
    let withData = options.withData || null;
    let scale = options.scale || 1;

    if(!img) {
        return null;
    }

    return getAsset(img, frame, color, flipped, custTileSize, outlineWidth, outlineColor, withData, scale);
}

export function setUseWidthInstead(use) {
    useWidthInstead = use;
}

function getImgObj(img, color, outlineColor, outlineWidth, flippedString, scale, custTileSize) {

    const imHash = hash(img);

    const imgObj = getOrCreate(imageAssets, imHash);
    const scaleObj = getOrCreate(imgObj, scale);
    const tileSizeObj = getOrCreate(scaleObj, custTileSize);
    const colorObj = getOrCreate(tileSizeObj, color);
    const outlineColorObj = getOrCreate(colorObj, outlineColor);
    const outlineWidthObj = getOrCreate(outlineColorObj, outlineWidth);

    if (outlineWidthObj[flippedString]) {
        return outlineWidthObj[flippedString];
    } else {
        const flipped = flippedString === "flip";
        outlineWidthObj[flippedString] = {
            frames: [],
            loading: true,
            init: false,
            color: color,
            outlineColor: outlineColor,
            outlineWidth: outlineWidth,
            flipped: flipped,
            scale: scale,
            tileSize: custTileSize
        };
        return outlineWidthObj[flippedString];
    }
}

function processLoadedSvgText(svgAsString, imgObj) {
    if (imgObj.color && imgObj.color !== "def") {
        svgAsString = svgAsString.replaceAll("fill:#ff00ff;", "fill:" + imgObj.color + ";");
    }

    const svgBlob = new Blob([svgAsString], { type: "image/svg+xml" });
    const url = window.URL.createObjectURL(svgBlob);
    let img = new Image();

    img.onload = () => {
        frameizeImage(img, imgObj);
        window.URL.revokeObjectURL(svgBlob);
    };

    img.addEventListener("error", e => handleImageError(e, imgObj));
    img.src = url;
}

function frameizeImage(img, imgObj) {

    let useScaleFactor = renderScaleFactor * imgObj.scale;

    let compareVal = img.height;

    if(useWidthInstead) {
        compareVal = img.width;
    }

    if(hardTileSize && hardTileSize > 0) {
        useScaleFactor = hardTileSize / compareVal;
    }
    
    const destHeight = img.height * useScaleFactor;

    imgObj.frames = [];

    let sourceTileSize = compareVal;

    if(imgObj.tileSize) {
        sourceTileSize = parseInt(imgObj.tileSize);
    }

    const totalSourceFrames = img.width / sourceTileSize;
    const destFrameWidth = sourceTileSize * useScaleFactor;
    

    const aCanvas = document.createElement("canvas");
    const aContext = aCanvas.getContext("2d",{
        willReadFrequently: true
    });

    for(let i = 0; i < totalSourceFrames; i++) {

        aCanvas.width = destFrameWidth;
        aCanvas.height = destHeight;

        let drawX = 0;

        aContext.save();

        if(imgObj.flipped) {
            aContext.scale(-1,1);
            drawX = -destFrameWidth;
        }

        aContext.drawImage(img,(i * sourceTileSize),0,sourceTileSize,img.height,drawX,0,destFrameWidth,destHeight);

        aContext.restore();
        
        if(imgObj.outlineWidth > 0) {

            const imgData = aContext.getImageData(0,0,aCanvas.width,aCanvas.height);
            const data = imgData.data;

            let allTrans = true;

            for(let i = 0; i < data.length; i += 4) {
                let alphaIdx = i + 3;

                let vla = data[alphaIdx];

                if(vla > 0) {
                    allTrans = false;
                    break;
                }
            }

            if(!allTrans) {

                let defineNonTransparent = function (x, y) {

                    if(x <= 0 || y <= 0) {
                        return false;
                    }

                    if(x > aCanvas.width || y > aCanvas.height) {
                        return false;
                    }

                    let checkval = (y * aCanvas.width + x) * 4 + 3;



                    if(checkval >= data.length) {
                        return false;
                    }

                    return (data[checkval] > 0);
                };

                const points = geom.contour(defineNonTransparent,null,data,aCanvas.width);

                if(points.length > 0) {
                    aContext.strokeStyle = imgObj.outlineColor;
                    aContext.lineWidth = parseFloat(imgObj.outlineWidth);

                    aContext.beginPath();
                    aContext.moveTo(points[0][0],points[0][4]);

                    for(let p=1; p < points.length; p++){
                        const point = points[p];
                        aContext.lineTo(point[0],point[1]);
                    }

                    aContext.closePath();
                    aContext.stroke();
                }
            }

            
            
        }
        
        let fail = false;

        try {
            const imFrame = new Image();
            imFrame.src = aCanvas.toDataURL();
            imgObj.frames.push(imFrame);
        } catch(ex) {
            console.log(ex);
            fail = true;
        }

        if(fail) {
            imgObj.frames = [];
            imgObj.loading = true;
            imgObj.init = false;

            return;
        }
        
    }

    imgObj.loading = false;

    img = null;
}

// eslint-disable-next-line no-unused-vars
geom.contour = function(grid, start, data, width) { 
    let s = start || d3_geom_contourStart(grid), // starting point 
        c = [],    // contour polygon 
        x = s[0],  // current x position 
        y = s[1],  // current y position 
        dx = 0,    // next x direction 
        dy = 0,    // next y direction 
        pdx = NaN, // previous x direction 
        pdy = NaN, // previous y direction 
        i = 0;

    do { 
        i = 0; 
        if (grid(x-1, y-1)) i += 1; 
        if (grid(x,   y-1)) i += 2; 
        if (grid(x-1, y  )) i += 4; 
        if (grid(x,   y  )) i += 8; 

        if (i === 6) { 
            dx = pdy === -1 ? -1 : 1; 
            dy = 0; 
        } else if (i === 9) { 
            dx = 0; 
            dy = pdx === 1 ? -1 : 1; 
        } else { 
            dx = d3_geom_contourDx[i]; 
            dy = d3_geom_contourDy[i]; 
        } 

        if (dx != pdx && dy != pdy) { 
            c.push([x, y]); 
            pdx = dx; 
            pdy = dy; 
        } 

        x += dx; 
        y += dy; 

    } while (s[0] != x || s[1] != y); 

    return c; 
};

function d3_geom_contourStart(grid) { 
    let x = 0, 
        y = 0; 

    // eslint-disable-next-line no-constant-condition
    while (true) { 

        if (grid(x,y)) { 
            return [x,y]; 
        } 
        if (x === 0) { 
            x = y + 1; 
            y = 0; 
        } else { 
            x = x - 1; 
            y = y + 1; 
        } 
    } 
}

function getOrCreate(obj, key) {
    if (!(key in obj)) {
        obj[key] = {};
    }
    return obj[key];
}

const handleImageError = (e, imgObj) => {
    console.error(e);
    imgObj.frames = [];
    imgObj.loading = true;
    imgObj.init = false;
};

export default {
    initAssets,
    setTileSize,
    setScaleFactor,
    getAsset,
    preloadAsset,
    setDefaultImageDirectory,
    getFrameCount,
    setHardTileSize,
    getAssetWithOptions,
    setUseWidthInstead
};