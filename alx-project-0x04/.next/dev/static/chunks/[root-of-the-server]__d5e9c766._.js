(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[turbopack]/browser/dev/hmr-client/hmr-client.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/// <reference path="../../../shared/runtime-types.d.ts" />
/// <reference path="../../runtime/base/dev-globals.d.ts" />
/// <reference path="../../runtime/base/dev-protocol.d.ts" />
/// <reference path="../../runtime/base/dev-extensions.ts" />
__turbopack_context__.s([
    "connect",
    ()=>connect,
    "setHooks",
    ()=>setHooks,
    "subscribeToUpdate",
    ()=>subscribeToUpdate
]);
function connect({ addMessageListener, sendMessage, onUpdateError = console.error }) {
    addMessageListener((msg)=>{
        switch(msg.type){
            case 'turbopack-connected':
                handleSocketConnected(sendMessage);
                break;
            default:
                try {
                    if (Array.isArray(msg.data)) {
                        for(let i = 0; i < msg.data.length; i++){
                            handleSocketMessage(msg.data[i]);
                        }
                    } else {
                        handleSocketMessage(msg.data);
                    }
                    applyAggregatedUpdates();
                } catch (e) {
                    console.warn('[Fast Refresh] performing full reload\n\n' + "Fast Refresh will perform a full reload when you edit a file that's imported by modules outside of the React rendering tree.\n" + 'You might have a file which exports a React component but also exports a value that is imported by a non-React component file.\n' + 'Consider migrating the non-React component export to a separate file and importing it into both files.\n\n' + 'It is also possible the parent component of the component you edited is a class component, which disables Fast Refresh.\n' + 'Fast Refresh requires at least one parent function component in your React tree.');
                    onUpdateError(e);
                    location.reload();
                }
                break;
        }
    });
    const queued = globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS;
    if (queued != null && !Array.isArray(queued)) {
        throw new Error('A separate HMR handler was already registered');
    }
    globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS = {
        push: ([chunkPath, callback])=>{
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    };
    if (Array.isArray(queued)) {
        for (const [chunkPath, callback] of queued){
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    }
}
const updateCallbackSets = new Map();
function sendJSON(sendMessage, message) {
    sendMessage(JSON.stringify(message));
}
function resourceKey(resource) {
    return JSON.stringify({
        path: resource.path,
        headers: resource.headers || null
    });
}
function subscribeToUpdates(sendMessage, resource) {
    sendJSON(sendMessage, {
        type: 'turbopack-subscribe',
        ...resource
    });
    return ()=>{
        sendJSON(sendMessage, {
            type: 'turbopack-unsubscribe',
            ...resource
        });
    };
}
function handleSocketConnected(sendMessage) {
    for (const key of updateCallbackSets.keys()){
        subscribeToUpdates(sendMessage, JSON.parse(key));
    }
}
// we aggregate all pending updates until the issues are resolved
const chunkListsWithPendingUpdates = new Map();
function aggregateUpdates(msg) {
    const key = resourceKey(msg.resource);
    let aggregated = chunkListsWithPendingUpdates.get(key);
    if (aggregated) {
        aggregated.instruction = mergeChunkListUpdates(aggregated.instruction, msg.instruction);
    } else {
        chunkListsWithPendingUpdates.set(key, msg);
    }
}
function applyAggregatedUpdates() {
    if (chunkListsWithPendingUpdates.size === 0) return;
    hooks.beforeRefresh();
    for (const msg of chunkListsWithPendingUpdates.values()){
        triggerUpdate(msg);
    }
    chunkListsWithPendingUpdates.clear();
    finalizeUpdate();
}
function mergeChunkListUpdates(updateA, updateB) {
    let chunks;
    if (updateA.chunks != null) {
        if (updateB.chunks == null) {
            chunks = updateA.chunks;
        } else {
            chunks = mergeChunkListChunks(updateA.chunks, updateB.chunks);
        }
    } else if (updateB.chunks != null) {
        chunks = updateB.chunks;
    }
    let merged;
    if (updateA.merged != null) {
        if (updateB.merged == null) {
            merged = updateA.merged;
        } else {
            // Since `merged` is an array of updates, we need to merge them all into
            // one, consistent update.
            // Since there can only be `EcmascriptMergeUpdates` in the array, there is
            // no need to key on the `type` field.
            let update = updateA.merged[0];
            for(let i = 1; i < updateA.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateA.merged[i]);
            }
            for(let i = 0; i < updateB.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateB.merged[i]);
            }
            merged = [
                update
            ];
        }
    } else if (updateB.merged != null) {
        merged = updateB.merged;
    }
    return {
        type: 'ChunkListUpdate',
        chunks,
        merged
    };
}
function mergeChunkListChunks(chunksA, chunksB) {
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    return chunks;
}
function mergeChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted' || updateA.type === 'deleted' && updateB.type === 'added') {
        return undefined;
    }
    if (updateA.type === 'partial') {
        invariant(updateA.instruction, 'Partial updates are unsupported');
    }
    if (updateB.type === 'partial') {
        invariant(updateB.instruction, 'Partial updates are unsupported');
    }
    return undefined;
}
function mergeChunkListEcmascriptMergedUpdates(mergedA, mergedB) {
    const entries = mergeEcmascriptChunkEntries(mergedA.entries, mergedB.entries);
    const chunks = mergeEcmascriptChunksUpdates(mergedA.chunks, mergedB.chunks);
    return {
        type: 'EcmascriptMergedUpdate',
        entries,
        chunks
    };
}
function mergeEcmascriptChunkEntries(entriesA, entriesB) {
    return {
        ...entriesA,
        ...entriesB
    };
}
function mergeEcmascriptChunksUpdates(chunksA, chunksB) {
    if (chunksA == null) {
        return chunksB;
    }
    if (chunksB == null) {
        return chunksA;
    }
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeEcmascriptChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    if (Object.keys(chunks).length === 0) {
        return undefined;
    }
    return chunks;
}
function mergeEcmascriptChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted') {
        // These two completely cancel each other out.
        return undefined;
    }
    if (updateA.type === 'deleted' && updateB.type === 'added') {
        const added = [];
        const deleted = [];
        const deletedModules = new Set(updateA.modules ?? []);
        const addedModules = new Set(updateB.modules ?? []);
        for (const moduleId of addedModules){
            if (!deletedModules.has(moduleId)) {
                added.push(moduleId);
            }
        }
        for (const moduleId of deletedModules){
            if (!addedModules.has(moduleId)) {
                deleted.push(moduleId);
            }
        }
        if (added.length === 0 && deleted.length === 0) {
            return undefined;
        }
        return {
            type: 'partial',
            added,
            deleted
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'partial') {
        const added = new Set([
            ...updateA.added ?? [],
            ...updateB.added ?? []
        ]);
        const deleted = new Set([
            ...updateA.deleted ?? [],
            ...updateB.deleted ?? []
        ]);
        if (updateB.added != null) {
            for (const moduleId of updateB.added){
                deleted.delete(moduleId);
            }
        }
        if (updateB.deleted != null) {
            for (const moduleId of updateB.deleted){
                added.delete(moduleId);
            }
        }
        return {
            type: 'partial',
            added: [
                ...added
            ],
            deleted: [
                ...deleted
            ]
        };
    }
    if (updateA.type === 'added' && updateB.type === 'partial') {
        const modules = new Set([
            ...updateA.modules ?? [],
            ...updateB.added ?? []
        ]);
        for (const moduleId of updateB.deleted ?? []){
            modules.delete(moduleId);
        }
        return {
            type: 'added',
            modules: [
                ...modules
            ]
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'deleted') {
        // We could eagerly return `updateB` here, but this would potentially be
        // incorrect if `updateA` has added modules.
        const modules = new Set(updateB.modules ?? []);
        if (updateA.added != null) {
            for (const moduleId of updateA.added){
                modules.delete(moduleId);
            }
        }
        return {
            type: 'deleted',
            modules: [
                ...modules
            ]
        };
    }
    // Any other update combination is invalid.
    return undefined;
}
function invariant(_, message) {
    throw new Error(`Invariant: ${message}`);
}
const CRITICAL = [
    'bug',
    'error',
    'fatal'
];
function compareByList(list, a, b) {
    const aI = list.indexOf(a) + 1 || list.length;
    const bI = list.indexOf(b) + 1 || list.length;
    return aI - bI;
}
const chunksWithIssues = new Map();
function emitIssues() {
    const issues = [];
    const deduplicationSet = new Set();
    for (const [_, chunkIssues] of chunksWithIssues){
        for (const chunkIssue of chunkIssues){
            if (deduplicationSet.has(chunkIssue.formatted)) continue;
            issues.push(chunkIssue);
            deduplicationSet.add(chunkIssue.formatted);
        }
    }
    sortIssues(issues);
    hooks.issues(issues);
}
function handleIssues(msg) {
    const key = resourceKey(msg.resource);
    let hasCriticalIssues = false;
    for (const issue of msg.issues){
        if (CRITICAL.includes(issue.severity)) {
            hasCriticalIssues = true;
        }
    }
    if (msg.issues.length > 0) {
        chunksWithIssues.set(key, msg.issues);
    } else if (chunksWithIssues.has(key)) {
        chunksWithIssues.delete(key);
    }
    emitIssues();
    return hasCriticalIssues;
}
const SEVERITY_ORDER = [
    'bug',
    'fatal',
    'error',
    'warning',
    'info',
    'log'
];
const CATEGORY_ORDER = [
    'parse',
    'resolve',
    'code generation',
    'rendering',
    'typescript',
    'other'
];
function sortIssues(issues) {
    issues.sort((a, b)=>{
        const first = compareByList(SEVERITY_ORDER, a.severity, b.severity);
        if (first !== 0) return first;
        return compareByList(CATEGORY_ORDER, a.category, b.category);
    });
}
const hooks = {
    beforeRefresh: ()=>{},
    refresh: ()=>{},
    buildOk: ()=>{},
    issues: (_issues)=>{}
};
function setHooks(newHooks) {
    Object.assign(hooks, newHooks);
}
function handleSocketMessage(msg) {
    sortIssues(msg.issues);
    handleIssues(msg);
    switch(msg.type){
        case 'issues':
            break;
        case 'partial':
            // aggregate updates
            aggregateUpdates(msg);
            break;
        default:
            // run single update
            const runHooks = chunkListsWithPendingUpdates.size === 0;
            if (runHooks) hooks.beforeRefresh();
            triggerUpdate(msg);
            if (runHooks) finalizeUpdate();
            break;
    }
}
function finalizeUpdate() {
    hooks.refresh();
    hooks.buildOk();
    // This is used by the Next.js integration test suite to notify it when HMR
    // updates have been completed.
    // TODO: Only run this in test environments (gate by `process.env.__NEXT_TEST_MODE`)
    if (globalThis.__NEXT_HMR_CB) {
        globalThis.__NEXT_HMR_CB();
        globalThis.__NEXT_HMR_CB = null;
    }
}
function subscribeToChunkUpdate(chunkListPath, sendMessage, callback) {
    return subscribeToUpdate({
        path: chunkListPath
    }, sendMessage, callback);
}
function subscribeToUpdate(resource, sendMessage, callback) {
    const key = resourceKey(resource);
    let callbackSet;
    const existingCallbackSet = updateCallbackSets.get(key);
    if (!existingCallbackSet) {
        callbackSet = {
            callbacks: new Set([
                callback
            ]),
            unsubscribe: subscribeToUpdates(sendMessage, resource)
        };
        updateCallbackSets.set(key, callbackSet);
    } else {
        existingCallbackSet.callbacks.add(callback);
        callbackSet = existingCallbackSet;
    }
    return ()=>{
        callbackSet.callbacks.delete(callback);
        if (callbackSet.callbacks.size === 0) {
            callbackSet.unsubscribe();
            updateCallbackSets.delete(key);
        }
    };
}
function triggerUpdate(msg) {
    const key = resourceKey(msg.resource);
    const callbackSet = updateCallbackSets.get(key);
    if (!callbackSet) {
        return;
    }
    for (const callback of callbackSet.callbacks){
        callback(msg);
    }
    if (msg.type === 'notFound') {
        // This indicates that the resource which we subscribed to either does not exist or
        // has been deleted. In either case, we should clear all update callbacks, so if a
        // new subscription is created for the same resource, it will send a new "subscribe"
        // message to the server.
        // No need to send an "unsubscribe" message to the server, it will have already
        // dropped the update stream before sending the "notFound" message.
        updateCallbackSets.delete(key);
    }
}
}),
"[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/alx-project-0x03-setup/alx-project-0x03/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$compiler$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/alx-project-0x03-setup/alx-project-0x03/node_modules/react/compiler-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2d$icons$2f$fa$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/alx-project-0x03-setup/alx-project-0x03/node_modules/react-icons/fa/index.mjs [client] (ecmascript)");
;
;
;
const Footer = ()=>{
    const $ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$compiler$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["c"])(10);
    if ($[0] !== "38c039b1fc427f76041e616152d3349be4fcc8481130976937023ab9ce2b6818") {
        for(let $i = 0; $i < 10; $i += 1){
            $[$i] = Symbol.for("react.memo_cache_sentinel");
        }
        $[0] = "38c039b1fc427f76041e616152d3349be4fcc8481130976937023ab9ce2b6818";
    }
    let t0;
    let t1;
    if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
        t0 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                    className: "text-xl font-bold mb-4",
                    children: "Splash App"
                }, void 0, false, {
                    fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                    lineNumber: 14,
                    columnNumber: 15
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-gray-400 mb-4",
                    children: "Your one-stop platform for all your needs. Connecting people, creating opportunities."
                }, void 0, false, {
                    fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                    lineNumber: 14,
                    columnNumber: 69
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-gray-400",
                    children: "© 2024 Splash App. All rights reserved."
                }, void 0, false, {
                    fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                    lineNumber: 14,
                    columnNumber: 192
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
            lineNumber: 14,
            columnNumber: 10
        }, ("TURBOPACK compile-time value", void 0));
        t1 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
            className: "text-lg font-semibold mb-4",
            children: "Useful Links"
        }, void 0, false, {
            fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
            lineNumber: 15,
            columnNumber: 10
        }, ("TURBOPACK compile-time value", void 0));
        $[1] = t0;
        $[2] = t1;
    } else {
        t0 = $[1];
        t1 = $[2];
    }
    let t2;
    if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
        t2 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
            className: "mb-2",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: "/about",
                className: "text-gray-400 hover:text-white transition duration-300",
                children: "About Us"
            }, void 0, false, {
                fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                lineNumber: 24,
                columnNumber: 31
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
            lineNumber: 24,
            columnNumber: 10
        }, ("TURBOPACK compile-time value", void 0));
        $[3] = t2;
    } else {
        t2 = $[3];
    }
    let t3;
    if ($[4] === Symbol.for("react.memo_cache_sentinel")) {
        t3 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
            className: "mb-2",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: "/services",
                className: "text-gray-400 hover:text-white transition duration-300",
                children: "Services"
            }, void 0, false, {
                fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                lineNumber: 31,
                columnNumber: 31
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
            lineNumber: 31,
            columnNumber: 10
        }, ("TURBOPACK compile-time value", void 0));
        $[4] = t3;
    } else {
        t3 = $[4];
    }
    let t4;
    let t5;
    if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
        t4 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            children: [
                t1,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                    children: [
                        t2,
                        t3,
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                            className: "mb-2",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "/contact",
                                className: "text-gray-400 hover:text-white transition duration-300",
                                children: "Contact Us"
                            }, void 0, false, {
                                fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                                lineNumber: 39,
                                columnNumber: 52
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                            lineNumber: 39,
                            columnNumber: 31
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                    lineNumber: 39,
                    columnNumber: 19
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
            lineNumber: 39,
            columnNumber: 10
        }, ("TURBOPACK compile-time value", void 0));
        t5 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
            className: "text-lg font-semibold mb-4",
            children: "Follow Us"
        }, void 0, false, {
            fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
            lineNumber: 40,
            columnNumber: 10
        }, ("TURBOPACK compile-time value", void 0));
        $[5] = t4;
        $[6] = t5;
    } else {
        t4 = $[5];
        t5 = $[6];
    }
    let t6;
    if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
        t6 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
            href: "https://facebook.com",
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-gray-400 hover:text-white transition duration-300",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2d$icons$2f$fa$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["FaFacebook"], {
                size: 24
            }, void 0, false, {
                fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                lineNumber: 49,
                columnNumber: 150
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
            lineNumber: 49,
            columnNumber: 10
        }, ("TURBOPACK compile-time value", void 0));
        $[7] = t6;
    } else {
        t6 = $[7];
    }
    let t7;
    if ($[8] === Symbol.for("react.memo_cache_sentinel")) {
        t7 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
            href: "https://twitter.com",
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-gray-400 hover:text-white transition duration-300",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2d$icons$2f$fa$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["FaTwitter"], {
                size: 24
            }, void 0, false, {
                fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                lineNumber: 56,
                columnNumber: 149
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
            lineNumber: 56,
            columnNumber: 10
        }, ("TURBOPACK compile-time value", void 0));
        $[8] = t7;
    } else {
        t7 = $[8];
    }
    let t8;
    if ($[9] === Symbol.for("react.memo_cache_sentinel")) {
        t8 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
            className: "bg-gray-900 text-white py-10",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8",
                children: [
                    t0,
                    t4,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            t5,
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex space-x-4",
                                children: [
                                    t6,
                                    t7,
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                        href: "https://instagram.com",
                                        target: "_blank",
                                        rel: "noopener noreferrer",
                                        className: "text-gray-400 hover:text-white transition duration-300",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2d$icons$2f$fa$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["FaInstagram"], {
                                            size: 24
                                        }, void 0, false, {
                                            fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                                            lineNumber: 63,
                                            columnNumber: 330
                                        }, ("TURBOPACK compile-time value", void 0))
                                    }, void 0, false, {
                                        fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                                        lineNumber: 63,
                                        columnNumber: 189
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                                lineNumber: 63,
                                columnNumber: 149
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                        lineNumber: 63,
                        columnNumber: 140
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
                lineNumber: 63,
                columnNumber: 59
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx",
            lineNumber: 63,
            columnNumber: 10
        }, ("TURBOPACK compile-time value", void 0));
        $[9] = t8;
    } else {
        t8 = $[9];
    }
    return t8;
};
_c = Footer;
const __TURBOPACK__default__export__ = Footer;
var _c;
__turbopack_context__.k.register(_c, "Footer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Layout.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/alx-project-0x03-setup/alx-project-0x03/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$compiler$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/alx-project-0x03-setup/alx-project-0x03/node_modules/react/compiler-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$components$2f$layouts$2f$Footer$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Footer.tsx [client] (ecmascript)");
;
;
;
const Layout = (t0)=>{
    const $ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$compiler$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["c"])(2);
    if ($[0] !== "6cbfa200e1dd1de00aab16239bfa9cfb80d14dc8d182d7fc34aa2520a416ef2e") {
        for(let $i = 0; $i < 2; $i += 1){
            $[$i] = Symbol.for("react.memo_cache_sentinel");
        }
        $[0] = "6cbfa200e1dd1de00aab16239bfa9cfb80d14dc8d182d7fc34aa2520a416ef2e";
    }
    let t1;
    if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
        t1 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col min-h-screen",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        children: "Welcome to Splash App"
                    }, void 0, false, {
                        fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Layout.tsx",
                        lineNumber: 18,
                        columnNumber: 56
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$components$2f$layouts$2f$Footer$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                        fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Layout.tsx",
                        lineNumber: 18,
                        columnNumber: 86
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Layout.tsx",
                lineNumber: 18,
                columnNumber: 12
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false);
        $[1] = t1;
    } else {
        t1 = $[1];
    }
    return t1;
};
_c = Layout;
const __TURBOPACK__default__export__ = Layout;
var _c;
__turbopack_context__.k.register(_c, "Layout");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/alx-project-0x03-setup/alx-project-0x03/pages/index.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/alx-project-0x03-setup/alx-project-0x03/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$compiler$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/alx-project-0x03-setup/alx-project-0x03/node_modules/react/compiler-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$components$2f$layouts$2f$Layout$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/alx-project-0x03-setup/alx-project-0x03/components/layouts/Layout.tsx [client] (ecmascript)");
;
;
;
const Home = ()=>{
    const $ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$compiler$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["c"])(2);
    if ($[0] !== "48f8ef36fbc6d6b96f6e4c1849c96814445d2d841b340bd53e634a329bc9d9e4") {
        for(let $i = 0; $i < 2; $i += 1){
            $[$i] = Symbol.for("react.memo_cache_sentinel");
        }
        $[0] = "48f8ef36fbc6d6b96f6e4c1849c96814445d2d841b340bd53e634a329bc9d9e4";
    }
    let t0;
    if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
        t0 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$alx$2d$project$2d$0x03$2d$setup$2f$alx$2d$project$2d$0x03$2f$components$2f$layouts$2f$Layout$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                fileName: "[project]/alx-project-0x03-setup/alx-project-0x03/pages/index.tsx",
                lineNumber: 14,
                columnNumber: 12
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false);
        $[1] = t0;
    } else {
        t0 = $[1];
    }
    return t0;
};
_c = Home;
const __TURBOPACK__default__export__ = Home;
var _c;
__turbopack_context__.k.register(_c, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[next]/entry/page-loader.ts { PAGE => \"[project]/alx-project-0x03-setup/alx-project-0x03/pages/index.tsx [client] (ecmascript)\" } [client] (ecmascript)", ((__turbopack_context__, module, exports) => {

const PAGE_PATH = "/";
(window.__NEXT_P = window.__NEXT_P || []).push([
    PAGE_PATH,
    ()=>{
        return __turbopack_context__.r("[project]/alx-project-0x03-setup/alx-project-0x03/pages/index.tsx [client] (ecmascript)");
    }
]);
// @ts-expect-error module.hot exists
if (module.hot) {
    // @ts-expect-error module.hot exists
    module.hot.dispose(function() {
        window.__NEXT_P.push([
            PAGE_PATH
        ]);
    });
}
}),
"[hmr-entry]/hmr-entry.js { ENTRY => \"[project]/alx-project-0x03-setup/alx-project-0x03/pages/index\" }", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.r("[next]/entry/page-loader.ts { PAGE => \"[project]/alx-project-0x03-setup/alx-project-0x03/pages/index.tsx [client] (ecmascript)\" } [client] (ecmascript)");
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__d5e9c766._.js.map