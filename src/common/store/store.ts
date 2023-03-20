import * as LzString from 'lz-string';

class Store {
    data: any;

    limitChecking: boolean;
    limit: number;

    usage: number;

    constructor() {
        if (window.Store) {
            throw Error('store has been inited');
        }
        window.Store = this;
        this.limit = 0;
        this.usage = 0;

        this.checkUsage();
    }

    set(key: string, value: string, cb?: {success?: Function, fail?: Function}): void {
        try {
            localStorage.setItem(key, value);
            this.checkUsage();
            cb && cb.success && cb.success();
        } catch(e) {
            cb && cb.fail && cb.fail();
        }
    }

    get(key: string): string {
        return localStorage.getItem(key);
    }

    checkUsage(): void {
        this.usage = Object.keys(localStorage).map(v => v + localStorage.getItem(v)).join('').length;
    }

    checkLimit(): void {
        window.Message.add({content: '正在检测缓存容量'});
        if (this.limitChecking) {
            return;
        }
        this.limitChecking = true;
        let base = this.usage;
        let addLength = 1000000;
        let index = 0;

        while (addLength > 2) {
            try {
                let key = `_test${index++}`;
                localStorage.setItem(key, new Array(addLength - key.length + 1).join('a'));    
                base += addLength;     
            } catch(e) {
                console.log(e);
                index--;
                addLength = Math.round(addLength / 2);
            }
        }
        this.limit = base;

        Object.keys(localStorage).filter(v => v.indexOf('_test') === 0).forEach(v => localStorage.removeItem(v));

        this.limitChecking = false;

        window.Message.add({content: '检测完成'});
    }
};

export default Store;