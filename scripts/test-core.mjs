import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await build({entryPoints:['tests/core.test.ts'],outfile:'.test-output/core.test.mjs',bundle:true,format:'esm',platform:'node',target:'node22',packages:'external',tsconfig:'tsconfig.json'});
const result=spawnSync(process.execPath,['--test','.test-output/core.test.mjs'],{stdio:'inherit'});
process.exit(result.status??1);
