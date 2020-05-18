import { iters } from '../util.js';
export var Requirement;
(function (Requirement) {
    function and(...cs) {
        return [[].concat(...cs.map(([c]) => c))];
    }
    Requirement.and = and;
    function or(...rs) {
        const out = [];
        for (const r of rs) {
            if (r === Requirement.OPEN)
                return Requirement.OPEN;
            if (r === Requirement.CLOSED)
                continue;
            out.push(...freeze(r));
        }
        if (!out.length)
            return Requirement.CLOSED;
        return out;
    }
    Requirement.or = or;
    function meet(left, right) {
        if (left === Requirement.OPEN)
            return freeze(right);
        if (right === Requirement.OPEN)
            return freeze(left);
        if (left === Requirement.CLOSED || right === Requirement.CLOSED)
            return Requirement.CLOSED;
        const out = new Builder();
        for (const ls of left) {
            for (const rs of right) {
                out.addList([...ls, ...rs]);
            }
        }
        return freeze(out);
    }
    Requirement.meet = meet;
    function freeze(r) {
        return r instanceof Builder ?
            [...iters.map(r, (cs) => [...cs])] : r;
    }
    Requirement.freeze = freeze;
    function label(r) {
        return r instanceof Builder ?
            r.label() :
            r.map((cs) => cs.join('&')).join('|');
    }
    Requirement.label = label;
    function isOpen(r) {
        const outer = r[Symbol.iterator]();
        const { value, done } = outer.next();
        if (done || !outer.next().done)
            return false;
        const inner = value[Symbol.iterator]();
        return inner.next().done;
    }
    Requirement.isOpen = isOpen;
    function isClosed(r) {
        const iter = r[Symbol.iterator]();
        return Boolean(iter.next().done);
    }
    Requirement.isClosed = isClosed;
    Requirement.OPEN = [[]];
    Requirement.CLOSED = [];
    class Builder {
        constructor(self) {
            this.self = self;
            this.map = new Map();
        }
        [Symbol.iterator]() {
            return this.map.values();
        }
        addInternal(newLabel, newDeps) {
            for (const c of newDeps)
                if (Array.isArray(c))
                    throw new Error();
            if (newDeps.has(this.self) || this.map.has(newLabel))
                return false;
            for (const [curLabel, curDeps] of this.map) {
                if (containsAll(newDeps, curDeps))
                    return false;
                if (containsAll(curDeps, newDeps))
                    this.map.delete(curLabel);
            }
            this.map.set(newLabel, newDeps);
            return true;
        }
        addRoute(route) {
            return this.addInternal(route[DEPS_LABEL], route.deps);
        }
        addAll(requirement) {
            for (const conditions of requirement) {
                this.addList(conditions);
            }
        }
        addList(conditions) {
            const sorted = [...new Set(conditions)].sort();
            const deps = new Set(sorted);
            this.addInternal(sorted.join('&'), deps);
        }
        restrict(r) {
            const l = [...this.map.values()];
            this.map.clear();
            for (const ls of l) {
                for (const rs of r) {
                    this.addList([...ls, ...rs]);
                }
            }
        }
        label() {
            return [this.map.keys()].join('|');
        }
    }
    Requirement.Builder = Builder;
})(Requirement || (Requirement = {}));
function containsAll(left, right) {
    if (left.size < right.size)
        return false;
    for (const d of right) {
        if (!left.has(d))
            return false;
    }
    return true;
}
const DEPS_LABEL = Symbol('depsLabel');
export class Route {
    constructor(target, conditions) {
        this.target = target;
        const sorted = [...new Set(conditions)].sort();
        this.deps = new Set(sorted);
        this[DEPS_LABEL] = sorted.join('&');
        this.label = `${this.target}:${this[DEPS_LABEL]}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWlyZW1lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvanMvbG9naWMvcmVxdWlyZW1lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLFlBQVksQ0FBQztBQVdqQyxNQUFNLEtBQVcsV0FBVyxDQWtJM0I7QUFsSUQsV0FBaUIsV0FBVztJQVExQixTQUFnQixHQUFHLENBQUMsR0FBRyxFQUFZO1FBQ2pDLE9BQU8sQ0FBRSxFQUFrQixDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUZlLGVBQUcsTUFFbEIsQ0FBQTtJQUVELFNBQWdCLEVBQUUsQ0FBQyxHQUFHLEVBQWlCO1FBQ3JDLE1BQU0sR0FBRyxHQUFnQyxFQUFFLENBQUM7UUFDNUMsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDbEIsSUFBSSxDQUFDLEtBQUssWUFBQSxJQUFJO2dCQUFFLE9BQU8sWUFBQSxJQUFJLENBQUM7WUFDNUIsSUFBSSxDQUFDLEtBQUssWUFBQSxNQUFNO2dCQUFFLFNBQVM7WUFDM0IsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3hCO1FBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNO1lBQUUsT0FBTyxZQUFBLE1BQU0sQ0FBQztRQUMvQixPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7SUFUZSxjQUFFLEtBU2pCLENBQUE7SUFHRCxTQUFnQixJQUFJLENBQUMsSUFBaUIsRUFBRSxLQUFrQjtRQUN4RCxJQUFJLElBQUksS0FBSyxZQUFBLElBQUk7WUFBRSxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN4QyxJQUFJLEtBQUssS0FBSyxZQUFB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SSxFQUFFLENBQUM7UUFDL0MsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1QixJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNwQyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztJQUNwRCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge2l0ZXJzfSBmcm9tICcuLi91dGlsLmpzJztcbmltcG9ydCB7VGlsZUlkfSBmcm9tICcuL3RpbGVpZC5qcyc7XG5cbi8vIE5PVEU6IFRoaXMgY291bGQgYmUgZXhwb3J0ZWQgaW50byBhIG5vbi1nYW1lLXNwZWNpZmljIGxpYnJhcnkuXG5cbi8qKiBBIHNpbmdsZSBmbGFnLCBpdGVtLCBvciBjb25kaXRpb24uICovXG5leHBvcnQgdHlwZSBDb25kaXRpb24gPSBudW1iZXIgJiB7X19jb25kaXRpb25fXzogbmV2ZXJ9O1xuXG4vLyBBIERORiBleHByZXNzaW9uIHJlcHJlc2VudGluZyBhIHNhdGlzZmlhYmxlIHNldCBvZiBjb25kaXRpb25zLlxuZXhwb3J0IHR5cGUgUmVxdWlyZW1lbnQgPSBJdGVyYWJsZTxJdGVyYWJsZTxDb25kaXRpb24+PjtcblxuZXhwb3J0IG5hbWVzcGFjZSBSZXF1aXJlbWVudCB7XG4gIC8qKiBBbiBpbW11dGFibGUgc2luZ2xlLXJvdXRlIHJlcXVpcmVtZW50LiAqL1xuICBleHBvcnQgdHlwZSBTaW5nbGUgPSByZWFkb25seSBbUmVhZG9ubHlBcnJheTxDb25kaXRpb24+XTtcblxuICAvKiogQSBcImZyb3plblwiIHJlcXVpcmVtZW50LCB3aGljaCBjYW4gYmUgdHJlYXRlZCBhcyBpbW11dGFibGUuICovXG4gIGV4cG9ydCB0eXBlIEZyb3plbiA9IFJlYWRvbmx5QXJyYXk8UmVhZG9ubHlBcnJheTxDb25kaXRpb24+PjtcblxuICAvKiogTWVldCBhIHNpbmdsZS1yb3V0ZSByZXF1aXJlbWVudHMgaW50byBhIG5ldyBzaW5nbGUtcm91dGUgcmVxdWlyZW1lbnQuICovXG4gIGV4cG9ydCBmdW5jdGlvbiBhbmQoLi4uY3M6IFNpbmdsZVtdKTogU2luZ2xlIHtcbiAgICByZXR1cm4gWyhbXSBhcyBDb25kaXRpb25bXSkuY29uY2F0KC4uLmNzLm1hcCgoW2NdKSA9PiBjKSldO1xuICB9XG4gIC8qKiBKb2luIGEgYnVuY2ggb2YgcmVxdWlyZW1lbnRzIGludG8gYSBuZXcgcmVxdWlyZW1lbnQuICovXG4gIGV4cG9ydCBmdW5jdGlvbiBvciguLi5yczogUmVxdWlyZW1lbnRbXSk6IEZyb3plbiB7XG4gICAgY29uc3Qgb3V0OiBBcnJheTxyZWFkb25seSBDb25kaXRpb25bXT4gPSBbXTtcbiAgICBmb3IgKGNvbnN0IHIgb2YgcnMpIHtcbiAgICAgIGlmIChyID09PSBPUEVOKSByZXR1cm4gT1BFTjtcbiAgICAgIGlmIChyID09PSBDTE9TRUQpIGNvbnRpbnVlO1xuICAgICAgb3V0LnB1c2goLi4uZnJlZXplKHIpKTtcbiAgICB9XG4gICAgaWYgKCFvdXQubGVuZ3RoKSByZXR1cm4gQ0xPU0VEO1xuICAgIHJldHVybiBvdXQ7XG4gIH1cblxuICAvKiogTWVldCBhIGJ1bmNoIG9mIGFyYml0cmFyeSByZXF1aXJlbWVudHMuICovXG4gIGV4cG9ydCBmdW5jdGlvbiBtZWV0KGxlZnQ6IFJlcXVpcmVtZW50LCByaWdodDogUmVxdWlyZW1lbnQpOiBGcm96ZW4ge1xuICAgIGlmIChsZWZ0ID09PSBPUEVOKSByZXR1cm4gZnJlZXplKHJpZ2h0KTtcbiAgICBpZiAocmlnaHQgPT09IE9QRU4pIHJldHVybiBmcmVlemUobGVmdCk7XG4gICAgaWYgKGxlZnQgPT09IENMT1NFRCB8fCByaWdodCA9PT0gQ0xPU0VEKSByZXR1cm4gQ0xPU0VEO1xuICAgIGNvbnN0IG91dCA9IG5ldyBCdWlsZGVyKCk7XG4gICAgZm9yIChjb25zdCBscyBvZiBsZWZ0KSB7XG4gICAgICBmb3IgKGNvbnN0IHJzIG9mIHJpZ2h0KSB7XG4gICAgICAgIG91dC5hZGRMaXN0KFsuLi5scywgLi4ucnNdKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZyZWV6ZShvdXQpO1xuICB9XG5cbiAgLyoqIEZyZWV6ZSBhbiBhcmJpdHJhcnkgcmVxdWlyZW1lbnQgaW50byBhbiBpbW11dGFibGUgcmVxdWlyZW1lbnQuICovXG4gIGV4cG9ydCBmdW5jdGlvbiBmcmVlemUocjogUmVxdWlyZW1lbnQpOiBGcm96ZW4ge1xuICAgIHJldHVybiByIGluc3RhbmNlb2YgQnVpbGRlciA/XG4gICAgICAgIFsuLi5pdGVycy5tYXAociwgKGNzOiBJdGVyYWJsZTxDb25kaXRpb24+KSA9PiBbLi4uY3NdKV0gOiByIGFzIEZyb3plbjtcbiAgfVxuXG4gIC8qKiBTZW1pLXVuaXF1ZWx5IG1hcHMgYSByZXF1aXJlbWVudCB0byBhIHN0cmluZy4gKi9cbiAgZXhwb3J0IGZ1bmN0aW9uIGxhYmVsKHI6IFJlcXVpcmVtZW50KTogc3RyaW5nIHtcbiAgICAvLyBOT1RFOiBlcXVpdmFsZW50IGZyb3plbiByZXF1aXJlbWVudHMgbWF5IGhhdmUgZGlmZmVyZW50IGxhYmVscyBkdWUgdG9cbiAgICAvLyBhcmJpdHJhcnkgb3JkZXJpbmcuXG4gICAgcmV0dXJuIHIgaW5zdGFuY2VvZiBCdWlsZGVyID9cbiAgICAgICAgci5sYWJlbCgpIDpcbiAgICAgICAgKHIgYXMgRnJvemVuKS5tYXAoKGNzOiBJdGVyYWJsZTxDb25kaXRpb24+KSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAoY3MgYXMgQXJyYXk8dW5rbm93bj4pLmpvaW4oJyYnKSkuam9pbignfCcpO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIGlzT3BlbihyOiBSZXF1aXJlbWVudCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG91dGVyID0gcltTeW1ib2wuaXRlcmF0b3JdKCk7XG4gICAgY29uc3Qge3ZhbHVlLCBkb25lfSA9IG91dGVyLm5leHQoKTtcbiAgICBpZiAoZG9uZSB8fCAhb3V0ZXIubmV4dCgpLmRvbmUpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBpbm5lciA9IHZhbHVlW1N5bWJvbC5pdGVyYXRvcl0oKTtcbiAgICByZXR1cm4gaW5uZXIubmV4dCgpLmRvbmU7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gaXNDbG9zZWQocjogUmVxdWlyZW1lbnQpOiBib29sZWFuIHtcbiAgICBjb25zdCBpdGVyID0gcltTeW1ib2wuaXRlcmF0b3JdKCk7XG4gICAgcmV0dXJuIEJvb2xlYW4oaXRlci5uZXh0KCkuZG9uZSk7XG4gIH1cblxuICAvKiogQSByZXF1aXJlbWVudCB0aGF0J3MgYWx3YXlzIG1ldC4gKi9cbiAgZXhwb3J0IGNvbnN0IE9QRU46IEZyb3plbiA9IFtbXV07XG5cbiAgLyoqIEEgcmVxdWlyZW1lbnQgdGhhdCdzIG5ldmVyIG1ldC4gKi9cbiAgZXhwb3J0IGNvbnN0IENMT1NFRDogRnJvemVuID0gW107XG5cbiAgLyoqIE11dGFibGUgYnVpbGRlciBjbGFzcyBmb3IgYnVpbGRpbmcgdXAgcmVxdWlyZW1lbnRzIHBpZWNlbWVhbC4gKi9cbiAgZXhwb3J0IGNsYXNzIEJ1aWxkZXIgaW1wbGVtZW50cyBSZXF1aXJlbWVudCB7XG4gICAgcHJpdmF0ZSByZWFkb25seSBtYXAgPSBuZXcgTWFwPHN0cmluZywgU2V0PENvbmRpdGlvbj4+KCk7XG5cbiAgICBjb25zdHJ1Y3RvcihyZWFkb25seSBzZWxmPzogQ29uZGl0aW9uKSB7fVxuXG4gICAgW1N5bWJvbC5pdGVyYXRvcl0oKTogSXRlcmF0b3I8SXRlcmFibGU8Q29uZGl0aW9uPj4ge1xuICAgICAgcmV0dXJuIHRoaXMubWFwLnZhbHVlcygpO1xuICAgIH1cblxuICAgIC8qKiBJbnRlcm5hbCBtZXRob2QgZm9yIGFjdHVhbGx5IGFkZGluZyBhIHJvdXRlLiAqL1xuICAgIHByaXZhdGUgYWRkSW50ZXJuYWwobmV3TGFiZWw6IHN0cmluZywgbmV3RGVwczogU2V0PENvbmRpdGlvbj4pOiBib29sZWFuIHtcbiAgICAgIGZvciAoY29uc3QgYyBvZiBuZXdEZXBzKSBpZiAoQXJyYXkuaXNBcnJheShjKSkgdGhyb3cgbmV3IEVycm9yKCk7XG5cbiAgICAgIGlmIChuZXdEZXBzLmhhcyh0aGlzLnNlbGYhKSB8fCB0aGlzLm1hcC5oYXMobmV3TGFiZWwpKSByZXR1cm4gZmFsc2U7XG4gICAgICBmb3IgKGNvbnN0IFtjdXJMYWJlbCwgY3VyRGVwc10gb2YgdGhpcy5tYXApIHtcbiAgICAgICAgaWYgKGNvbnRhaW5zQWxsKG5ld0RlcHMsIGN1ckRlcHMpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmIChjb250YWluc0FsbChjdXJEZXBzLCBuZXdEZXBzKSkgdGhpcy5tYXAuZGVsZXRlKGN1ckxhYmVsKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubWFwLnNldChuZXdMYWJlbCwgbmV3RGVwcyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKiogSm9pbnMgYSByb3V0ZSdzIHJlcXVpcmVtZW50cy4gKi9cbiAgICBhZGRSb3V0ZShyb3V0ZTogUm91dGUpOiBib29sZWFuIHtcbiAgICAgIHJldHVybiB0aGlzLmFkZEludGVybmFsKHJvdXRlW0RFUFNfTEFCRUxdLCByb3V0ZS5kZXBzKTtcbiAgICB9XG5cbiAgICAvKiogSm9pbnMgYW4gYXJiaXRyYXJ5IHJlcXVpcmVtZW50IGluIHBsYWNlLiAqL1xuICAgIGFkZEFsbChyZXF1aXJlbWVudDogUmVxdWlyZW1lbnQpOiB2b2lkIHtcbiAgICAgIGZvciAoY29uc3QgY29uZGl0aW9ucyBvZiByZXF1aXJlbWVudCkge1xuICAgICAgICB0aGlzLmFkZExpc3QoY29uZGl0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEpvaW5zIGEgc2luZ2xlLXJvdXRlIHJlcXVpcmVtZW50IGluIHBsYWNlLiAqL1xuICAgIGFkZExpc3QoY29uZGl0aW9uczogSXRlcmFibGU8Q29uZGl0aW9uPik6IHZvaWQge1xuICAgICAgY29uc3Qgc29ydGVkID0gWy4uLm5ldyBTZXQoY29uZGl0aW9ucyldLnNvcnQoKTtcbiAgICAgIGNvbnN0IGRlcHMgPSBuZXcgU2V0KHNvcnRlZCk7XG4gICAgICB0aGlzLmFkZEludGVybmFsKHNvcnRlZC5qb2luKCcmJyksIGRlcHMpO1xuICAgIH1cblxuICAgIC8qKiBNZWV0IHRoaXMgcmVxdWlyZW1lbnQgaW4tcGxhY2Ugd2l0aCB0aGUgZ2l2ZW4gcmVxdWlyZW1lbnQuICovXG4gICAgcmVzdHJpY3QocjogUmVxdWlyZW1lbnQpOiB2b2lkIHtcbiAgICAgIGNvbnN0IGwgPSBbLi4udGhpcy5tYXAudmFsdWVzKCldO1xuICAgICAgdGhpcy5tYXAuY2xlYXIoKTtcbiAgICAgIGZvciAoY29uc3QgbHMgb2YgbCkge1xuICAgICAgICBmb3IgKGNvbnN0IHJzIG9mIHIpIHtcbiAgICAgICAgICB0aGlzLmFkZExpc3QoWy4uLmxzLCAuLi5yc10pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqIFJldHVybnMgYSBsYWJlbC4gKi9cbiAgICBsYWJlbCgpIHtcbiAgICAgIHJldHVybiBbdGhpcy5tYXAua2V5cygpXS5qb2luKCd8Jyk7XG4gICAgfVxuICB9XG59XG5cbi8qKiBIZWxwZXIgZnVuY3Rpb24gZm9yIGJ1aWxkaW5nIHJlcXVpcmVtZW50cy4gKi9cbmZ1bmN0aW9uIGNvbnRhaW5zQWxsPFQ+KGxlZnQ6IFNldDxUPiwgcmlnaHQ6IFNldDxUPik6IGJvb2xlYW4ge1xuICBpZiAobGVmdC5zaXplIDwgcmlnaHQuc2l6ZSkgcmV0dXJuIGZhbHNlO1xuICBmb3IgKGNvbnN0IGQgb2YgcmlnaHQpIHtcbiAgICBpZiAoIWxlZnQuaGFzKGQpKSByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmNvbnN0IERFUFNfTEFCRUw6IHVuaXF1ZSBzeW1ib2wgPSBTeW1ib2woJ2RlcHNMYWJlbCcpO1xuZXhwb3J0IGNsYXNzIFJvdXRlIHtcbiAgcmVhZG9ubHkgW0RFUFNfTEFCRUxdOiBzdHJpbmc7IC8vIHVzZWQgZm9yIGRpcmVjdC1hZGRpbmcgdG8gYSBidWlsZGVyLlxuICByZWFkb25seSBkZXBzOiBTZXQ8Q29uZGl0aW9uPjtcbiAgcmVhZG9ubHkgbGFiZWw6IHN0cmluZztcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgdGFyZ2V0OiBUaWxlSWQsIGNvbmRpdGlvbnM6IHJlYWRvbmx5IENvbmRpdGlvbltdKSB7XG4gICAgY29uc3Qgc29ydGVkID0gWy4uLm5ldyBTZXQoY29uZGl0aW9ucyldLnNvcnQoKTtcbiAgICB0aGlzLmRlcHMgPSBuZXcgU2V0KHNvcnRlZCk7XG4gICAgdGhpc1tERVBTX0xBQkVMXSA9IHNvcnRlZC5qb2luKCcmJyk7XG4gICAgdGhpcy5sYWJlbCA9IGAke3RoaXMudGFyZ2V0fToke3RoaXNbREVQU19MQUJFTF19YDtcbiAgfVxufVxuIl19