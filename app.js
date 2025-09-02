// app.js
let lastValidState = {
    rows: 16,
    cols: 16
};

const state = {
    currentColor: '#ff0000',
    currentTool: 'brush',
    gridVisible: true,
    isDrawing: false,
    currentZoom: 1,
    deleteQueue: null,
    mirrorMode: { active: false, type: 'vertical' },
    paletas: JSON.parse(localStorage.getItem('paletas')) || {
        'default': ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00']
    },
    currentPalette: 'default'
};

const dom = {
    grid: document.getElementById('grid'),
    colorInput: document.getElementById('colorInput'),
    colorPreview: document.getElementById('colorPreview'),
    confirmDialog: document.getElementById('confirmDialog'),
    paletteSelector: document.getElementById('paletteSelector'),
    zoomLevel: document.getElementById('zoomLevel')
};

function safeUpdateGrid() {
    try {
        const rows = Math.max(8, Math.min(64, parseInt(document.getElementById('rows').value) || 16));
        const cols = Math.max(8, Math.min(64, parseInt(document.getElementById('cols').value) || 16));

        dom.grid.style.gridTemplateColumns = `repeat(${cols}, 20px)`;
        dom.grid.className = state.gridVisible ? 'grid-visible' : '';
        
        const fragment = document.createDocumentFragment();
        for(let i = 0; i < rows * cols; i++) {
            fragment.appendChild(createPixel());
        }
        
        dom.grid.innerHTML = '';
        dom.grid.appendChild(fragment);
        state.isDrawing = false;

        lastValidState = {
            rows: rows,
            cols: cols
        };

        dom.grid.style.display = 'none';
        dom.grid.offsetHeight;
        dom.grid.style.display = 'grid';
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('rows').value = lastValidState.rows;
        document.getElementById('cols').value = lastValidState.cols;
        safeUpdateGrid();
    }
}

function createPixel() {
    const pixel = document.createElement('div');
    pixel.className = 'pixel';
    pixel.draggable = false;
    
    pixel.addEventListener('mousedown', startDrawing);
    pixel.addEventListener('mousemove', handleDrawing);
    pixel.addEventListener('touchstart', startDrawing);
    pixel.addEventListener('touchmove', handleTouchDrawing);
    
    return pixel;
}

function setupEventListeners() {
    dom.colorInput.addEventListener('input', e => {
        state.currentColor = e.target.value;
        updateColorPreview();
    });

    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            state.currentTool = this.dataset.tool;
        });
    });

    document.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('pixel')) {
            state.isDrawing = true;
            handleDrawing(e.target);
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (state.isDrawing && e.target.classList.contains('pixel')) {
            handleDrawing(e.target);
        }
    });

    document.addEventListener('mouseup', stopDrawing);
    document.addEventListener('touchend', stopDrawing);

    document.addEventListener('selectstart', function(e) {
        if (e.target.classList.contains('pixel')) {
            e.preventDefault();
        }
    });
}

function startDrawing(e) {
    e.preventDefault();
    state.isDrawing = true;
    handleDrawing(e.target);
}

function handleDrawing(pixel) {
    if(!state.isDrawing || !pixel?.classList?.contains('pixel')) return;
    
    applyColor(pixel);
    if(state.mirrorMode.active) applyMirrorEffect(pixel);
    if(state.symmetricGrid) applySymmetry(pixel);
}

function stopDrawing() {
    state.isDrawing = false;
}

function applySymmetry(pixel) {
    const index = Array.from(dom.grid.children).indexOf(pixel);
    const total = dom.grid.children.length;
    const mirrorIndex = total - 1 - index;
    
    if(mirrorIndex >= 0 && mirrorIndex < total) {
        applyColor(dom.grid.children[mirrorIndex]);
    }
}

function applyMirrorEffect(originalPixel) {
    const index = Array.from(dom.grid.children).indexOf(originalPixel);
    const cols = parseInt(document.getElementById('cols').value);
    const rows = parseInt(document.getElementById('rows').value);
    const mirrorIndices = [];

    switch(state.mirrorMode.type) {
        case 'vertical':
            mirrorIndices.push(Math.floor(index / cols) * cols + (cols - 1 - (index % cols)));
            break;
        case 'horizontal':
            mirrorIndices.push((rows - 1 - Math.floor(index / cols)) * cols + (index % cols));
            break;
        case 'diagonal':
            mirrorIndices.push(
                Math.floor(index / cols) * cols + (cols - 1 - (index % cols)),
                (rows - 1 - Math.floor(index / cols)) * cols + (index % cols)
            );
            break;
    }

    mirrorIndices.forEach(idx => {
        if(dom.grid.children[idx]) {
            applyColor(dom.grid.children[idx]);
        }
    });
}

function applyColor(pixel) {
    if(!pixel) return;
    
    switch(state.currentTool) {
        case 'brush':
            pixel.style.backgroundColor = state.currentColor;
            break;
        case 'eraser':
            pixel.style.backgroundColor = '#ffffff';
            break;
        case 'fill':
            floodFill(pixel);
            break;
        case 'picker':
            state.currentColor = pixel.style.backgroundColor;
            updateColorPreview();
            break;
    }
}

function floodFill(startPixel) {
    const targetColor = startPixel.style.backgroundColor;
    if(targetColor === state.currentColor) return;
    
    const queue = [startPixel];
    const visited = new Set();
    const cols = parseInt(document.getElementById('cols').value);
    
    while(queue.length > 0) {
        const current = queue.shift();
        if(!visited.has(current) && current.style.backgroundColor === targetColor) {
            current.style.backgroundColor = state.currentColor;
            visited.add(current);
            
            const index = Array.from(dom.grid.children).indexOf(current);
            const neighbors = [];
            
            if(index % cols > 0) neighbors.push(index - 1);
            if(index % cols < cols - 1) neighbors.push(index + 1);
            if(index >= cols) neighbors.push(index - cols);
            if(index < dom.grid.children.length - cols) neighbors.push(index + cols);
            
            neighbors.forEach(idx => {
                if(!visited.has(dom.grid.children[idx])) {
                    queue.push(dom.grid.children[idx]);
                }
            });
        }
    }
}

function updateColorPreview() {
    dom.colorPreview.style.backgroundColor = state.currentColor;
}

function addToPalette() {
    const hexColor = rgbToHex(state.currentColor);
    if(!state.paletas[state.currentPalette].includes(hexColor)) {
        state.paletas[state.currentPalette].push(hexColor);
        renderPalette();
        savePalettes();
    }
}

function deleteColor(colorElement) {
    state.deleteQueue = {
        element: colorElement,
        color: rgbToHex(colorElement.querySelector('.color-swatch').style.backgroundColor)
    };
    const rect = document.querySelector('.color-picker').getBoundingClientRect();
    dom.confirmDialog.style.top = `${rect.bottom + 10}px`;
    dom.confirmDialog.style.left = `${rect.left + (rect.width/2 - 100)}px`;
    dom.confirmDialog.style.display = 'block';
}

function handleConfirm(response) {
    dom.confirmDialog.style.display = 'none';
    if(response && state.deleteQueue) {
        const colorIndex = state.paletas[state.currentPalette].findIndex(c => 
            rgbToHex(c) === state.deleteQueue.color || c === state.deleteQueue.color
        );
        
        if(colorIndex > -1) {
            state.paletas[state.currentPalette].splice(colorIndex, 1);
            state.deleteQueue.element.remove();
            savePalettes();
        }
    }
    state.deleteQueue = null;
}

function rgbToHex(rgb) {
    if (!rgb) return '#000000';
    if (rgb.startsWith('#')) return rgb.toLowerCase();
    
    const values = rgb.match(/\d+/g)?.map(Number) || [0,0,0];
    return '#' + values.map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function toggleGrid() {
    state.gridVisible = !state.gridVisible;
    dom.grid.classList.toggle('grid-visible', state.gridVisible);
}

function toggleSymmetry() {
    state.symmetricGrid = !state.symmetricGrid;
    dom.symmetryStatus.textContent = state.symmetricGrid ? "Desactivar Simetria" : "Activar Simetria";
    safeUpdateGrid();
}

function adjustZoom(amount) {
    state.currentZoom = Math.max(0.5, Math.min(3, state.currentZoom + amount));
    document.getElementById('gridContainer').style.transform = `scale(${state.currentZoom})`;
    dom.zoomLevel.textContent = `${Math.round(state.currentZoom * 100)}%`;
}

function clearGrid() {
    document.querySelectorAll('.pixel').forEach(pixel => {
        pixel.style.backgroundColor = '#ffffff';
    });
}

function saveArt() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = 20;
    const cols = parseInt(document.getElementById('cols').value);
    const rows = parseInt(document.getElementById('rows').value);
    
    canvas.width = cols * scale;
    canvas.height = rows * scale;
    ctx.imageSmoothingEnabled = false;

    document.querySelectorAll('.pixel').forEach((pixel, index) => {
        const x = (index % cols) * scale;
        const y = Math.floor(index / cols) * scale;
        ctx.fillStyle = pixel.style.backgroundColor || '#FFFFFF';
        ctx.fillRect(x, y, scale, scale);
    });

    const link = document.createElement('a');
    link.download = `pixel-art-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

function initPalettes() {
    dom.paletteSelector.innerHTML = Object.keys(state.paletas).map(p => 
        `<option ${p === state.currentPalette ? 'selected' : ''}>${p}</option>`
    ).join('');
    renderPalette();
}

function newPalette() {
    const name = prompt('Nombre de la nueva paleta:');
    if(name && !state.paletas[name]) {
        state.paletas[name] = [];
        state.currentPalette = name;
        initPalettes();
        savePalettes();
    }
}

function changePalette(name) {
    state.currentPalette = name;
    renderPalette();
}

function renderPalette() {
    const container = document.getElementById('colorPalette');
    container.innerHTML = state.paletas[state.currentPalette].map(color => `
        <div class="color-swatch-container">
            <div class="color-swatch" style="background: ${color}"></div>
            <div class="delete-color" onclick="deleteColor(this.parentElement)"></div>
        </div>
    `).join('');
}

function savePalettes() {
    localStorage.setItem('paletas', JSON.stringify(state.paletas));
}

function toggleMirrorMode() {
    state.mirrorMode.active = !state.mirrorMode.active;
    document.querySelector('.mirror-controls button').classList.toggle('active');
}

function changeMirrorType(type) {
    state.mirrorMode.type = type;
}

function handleTouchDrawing(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const pixel = document.elementFromPoint(touch.clientX, touch.clientY);
    handleDrawing(pixel);
}

function init() {
    setupEventListeners();
    safeUpdateGrid();
    updateColorPreview();
    initPalettes();
}

document.addEventListener('DOMContentLoaded', init);
