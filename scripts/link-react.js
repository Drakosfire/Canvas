#!/usr/bin/env node

/**
 * Ensure the Canvas workspace reuses the LandingPage React/ReactDOM instances.
 *
 * When Canvas installs its dev dependencies locally, npm hoists a private copy of
 * react/react-dom into Canvas/node_modules. Importing the published package from
 * LandingPage then results in two distinct React singletons, triggering the
 * "dispatcher is null" / invalid hook call error. Symlinking both packages back to
 * the LandingPage node_modules guarantees a shared instance without forcing a
 * monorepo tooling change.
 */

const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(workspaceRoot, '..');
const landingPageNodeModules = path.join(projectRoot, 'LandingPage', 'node_modules');

const dependencyNames = ['react', 'react-dom'];

const ensureSymlink = (dependencyName) => {
    const source = path.join(landingPageNodeModules, dependencyName);
    const target = path.join(workspaceRoot, 'node_modules', dependencyName);

    if (!fs.existsSync(source)) {
        // LandingPage hasn't installed dependencies; nothing to do.
        return false;
    }

    try {
        const targetStat = fs.lstatSync(target);
        if (targetStat.isSymbolicLink()) {
            const currentDestination = fs.readlinkSync(target);
            const resolvedDestination = path.resolve(path.dirname(target), currentDestination);
            if (resolvedDestination === source) {
                return true;
            }
        }
        // Either a real directory or a symlink pointing elsewhere – remove and replace.
        fs.rmSync(target, { recursive: true, force: true });
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }

    // Create parent directory if needed (installation scripts can run before npm creates it).
    fs.mkdirSync(path.dirname(target), { recursive: true });

    fs.symlinkSync(source, target, 'junction');
    return true;
};

const linkedResults = dependencyNames.map((name) => ensureSymlink(name));

const linkedCount = linkedResults.filter(Boolean).length;
if (linkedCount > 0) {
    const noun = linkedCount === 1 ? 'dependency' : 'dependencies';
    console.log(`[link-react] Linked ${linkedCount} shared React ${noun} from LandingPage.`);
} else {
    console.log('[link-react] LandingPage React dependencies not found; skipping symlink creation.');
}

