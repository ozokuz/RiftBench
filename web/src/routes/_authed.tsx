import {Outlet, createFileRoute, redirect} from '@tanstack/react-router'
import {getCurrentUserFn} from "@/server/auth.ts";
import {currentUserQueryOptions, setClientAccessToken} from "@/lib/auth";

export const Route = createFileRoute('/_authed')({
    component: Outlet,
    beforeLoad: async ({context, location}) => {
        const user = await context.queryClient.ensureQueryData(
            currentUserQueryOptions(() => getCurrentUserFn()),
        );
        
        if (!user) {
            throw redirect({
                to: '/login',
                search: {redirect: location.href}
            })
        }

        if (typeof window !== "undefined") {
            setClientAccessToken(user.accessToken)
        }

        return {user}
    }
})
