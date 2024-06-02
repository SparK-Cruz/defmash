#!/usr/bin/env node

import fs, { readdir } from "fs";
import merge from "deepmerge";
import generate from "generate-schema";
import path, { basename } from "path";

const deepFilter = (() => {
    const removeMe = Symbol("removeMe");
    const stack = [];

    return (content, test) => {
        if (content == null)
            return null;

        if (Array.isArray(content)) {
            return content.map((item, index) => {
                stack.push(index);
                try {
                    return deepFilter(item, test);
                } finally {
                    stack.pop();
                }
            });
        }

        if (typeof content !== 'object') {
            return content;
        }

        return Object.fromEntries(Object.entries(content).map(([key, value]) => {
            stack.push(key);

            try {
                if (!test(value, [...stack]))
                    return removeMe;

                return [key, deepFilter(value, test)];
            } finally {
                stack.pop();
            }
        }).filter(e => e !== removeMe));
    }
})();

const writeFile = (name, files) => {
    const objects = files.map(f => {
        return JSON.parse(fs.readFileSync(f, 'utf8'));
    });

    const merged = merge.all(objects);
    const title = path.basename(name, ".schema.json");

    // Tira a lista de required do schema sem tirar qualquer propriedade que possa se chamar "required" no json original
    const generated = deepFilter(generate.json(title, merged), (value, key) => {
        return (!['$schema', 'required'].includes(key.pop()) || key.pop() === 'properties');
    });

    fs.writeFileSync(name, JSON.stringify(generated, null, 4));
}

const baseDir = path.resolve("./schemas");

fs.readdirSync("./schemas").forEach(async entry => {
    const absolute = path.resolve(baseDir, entry);

    if (fs.statSync(absolute).isFile())
        return;

    const name = `${absolute}.schema.json`;

    if (fs.existsSync(name))
        return;

    const files = fs.readdirSync(absolute).map(f => path.resolve(absolute, f)).filter(f => f.endsWith(".json"));
    writeFile(name, files);
});