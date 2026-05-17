import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"
import { heyApiPlugin } from "@hey-api/vite-plugin"

const config = defineConfig(({ command }) => ({
    plugins: [
        devtools(),
        nitro(),
        // this is the plugin that enables path aliases
        viteTsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
        tailwindcss(),
        tanstackStart(),
        viteReact(),
        heyApiPlugin({
            config: {
                input: {
                    path: '../RiftBench.API/RiftBench.API.json',
                    watch: command === "serve",
                },
                output: 'src/client',
                plugins: [
                    'zod',
                    {
                        enums: 'javascript',
                        name: '@hey-api/typescript',
                    },
                    {
                        name: '@hey-api/sdk',
                        auth: false,
                    },
                    '@hey-api/client-ofetch',
                    '@tanstack/react-query',
                ]
            }
        })
    ],
}))

export default config
