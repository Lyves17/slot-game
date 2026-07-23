export class SlotMachineRNG {
    catalog;
    REEL_COLUMNS = 3;
    REEL_ROWS = 3;
    constructor(catalog) {
        this.catalog = catalog;
    }
    getRandomSymbol() {
        const totalWeight = this.catalog.reduce((sum, s) => sum + s.weight, 0);
        let r = Math.random() * totalWeight;
        for (const symbol of this.catalog) {
            if (r < symbol.weight)
                return symbol;
            r -= symbol.weight;
        }
        return this.catalog[0];
    }
    generateSpin() {
        const grid = [];
        for (let c = 0; c < this.REEL_COLUMNS; c++) {
            const column = [];
            for (let r = 0; r < this.REEL_ROWS; r++) {
                column.push(this.getRandomSymbol());
            }
            grid.push(column);
        }
        return {
            grid: grid,
            totalWin: 0,
            isWin: false
        };
    }
}
