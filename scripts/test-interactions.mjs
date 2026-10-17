import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await import('./build-client.mjs');
const types=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','-p','tests/tsconfig.client.json'],{stdio:'inherit'});if(types.status)process.exit(types.status);
await build({entryPoints:['tests/interactions.test.tsx'],outfile:'.test-output/interactions.test.mjs',bundle:true,format:'esm',platform:'node',target:'node22',packages:'external',jsx:'automatic',tsconfig:'tsconfig.json'});
const result=spawnSync(process.execPath,['--test','.test-output/interactions.test.mjs'],{stdio:'inherit'});process.exit(result.status??1);
