import {Outlet, createFileRoute, redirect} from '@tanstack/react-router'
import {getCurrentUserFn} from "@/server/auth.ts";

export const Route = createFileRoute('/_authed')({
    component: Outlet,
    beforeLoad: async ({location}) => {
        const user = await getCurrentUserFn();
        
        if (!user) {
            throw redirect({
                to: '/login',
                search: {redirect: location.href}
            })
        }

        return {user}
    }
})
