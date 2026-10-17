import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await build({entryPoints:['tests/auth.test.ts'],outfile:'.test-output/auth.test.mjs',bundle:true,format:'esm',platform:'node',target:'node22',packages:'external',tsconfig:'tsconfig.json'});
const result=spawnSync(process.execPath,['--test','.test-output/auth.test.mjs'],{stdio:'inherit'});process.exit(result.status??1);
