// 文字内容配置管理
class TextDataManager {
    constructor() {
        this.items = [];
        this.pageSize = 10; // 每次加载的文字数量
        this.currentPage = 0;
        
        // 移除颜色数组，改用颜色生成方法
        this.baseHues = [0, 60, 120, 180, 240, 300]; // 基础色相值（红、黄、绿、青、蓝、紫）
        
        // 修改显示顺序，Hello World! 作为最内层
        this.displayOrder = [
            'Hello World!',  // 最内层
            'Three.js',
            'JavaScript',
            'Python',
            'Java',
            'C++',
            'React',
            'Vue',
            'Angular',
            'Node.js',
            'linzefei',
            'Cursor',
            '2025'         // 最外层
        ];
    }

    // 使用文本内容生成确定性的颜色
    generateColor(text) {
        // 使用文本内容生成一个确定的数值
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = text.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // 选择基础色相
        const baseHue = this.baseHues[Math.abs(hash) % this.baseHues.length];
        
        // 使用hash生成饱和度和亮度的变化
        const saturation = 50 + (Math.abs(hash) % 50); // 50-100%
        const lightness = 40 + (Math.abs(hash >> 4) % 20); // 40-60%
        
        // 转换HSL为RGB
        const color = this.hslToRgb(baseHue, saturation, lightness);
        console.log(`Generated color for "${text}":`, 
            '#' + color.toString(16).padStart(6, '0'));
        return color;
    }

    // HSL转RGB的辅助方法
    hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;
        
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        // 转换为THREE.js颜色格式
        return (Math.round(r * 255) << 16) |
               (Math.round(g * 255) << 8) |
                Math.round(b * 255);
    }

    // 添加单个文字
    addText(text) {
        const existingItem = this.items.find(item => item.text === text);
        if (!existingItem) {
            this.items.push({
                text: text,
                color: this.generateColor(text),
                created: Date.now()
            });
            return true;
        }
        return false;
    }

    // 批量添加文字
    addTexts(texts) {
        texts.forEach(text => this.addText(text));
    }

    // 移除文字
    removeText(text) {
        const index = this.items.findIndex(item => item.text === text);
        if (index > -1) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }

    // 获取下一页文字
    getNextPage() {
        const start = this.currentPage * this.pageSize;
        const end = Math.min(start + this.pageSize, this.displayOrder.length);
        
        // 根据显示顺序返回文本
        const items = this.displayOrder.slice(start, end).map(text => {
            // 如果文本不在 items 中，先添加它
            if (!this.items.find(item => item.text === text)) {
                this.addText(text);
            }
            return this.items.find(item => item.text === text);
        }).filter(item => item); // 过滤掉可能的空值
        
        if (items.length > 0) {
            this.currentPage++;
        }
        
        return items;
    }

    // 重置分页
    resetPaging() {
        this.currentPage = 0;
    }

    // 清空所有文字
    clear() {
        this.items = [];
        this.currentPage = 0;
    }

    // 获取当前总数
    getCount() {
        return this.displayOrder.length;
    }

    // 设置每页加载数量
    setPageSize(size) {
        this.pageSize = size;
    }
}

// 创建全局实例
const TextData = new TextDataManager();

// 初始化数据（可以移除这部分，因为我们现在使用 displayOrder）
// TextData.addTexts([...]); 