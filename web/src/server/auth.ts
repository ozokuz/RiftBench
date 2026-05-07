import { createServerFn } from "@tanstack/react-start"
import { redirect } from "@tanstack/react-router"
import { useSession } from "@tanstack/react-start/server"
import {
  getMe,
  postAuthExchange,
  postAuthLogout,
  postAuthRefresh,
} from "@/client/sdk.gen"

type SessionData = {
  username?: string
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
}

function useAppSession() {
  return useSession<SessionData>({
    name: "app-session",
    password:
      process.env.SESSION_SECRET! ||
      "4JTnmlifuZsfDgUCTeFvJNQNtTsENxkXEfvoedmZWUI=",
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      httpOnly: true,
    },
  })
}

export const authenticateFn = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    const tokens = await postAuthExchange({
      body: { code: data.code },
      baseUrl: process.env.VITE_API_BASE,
    })

    if (tokens.error || !tokens.data) {
      throw new Error("Invalid code!")
    }

    const session = await useAppSession()
    await session.update({
      ...tokens.data,
    })

    return { accessToken: tokens.data.accessToken }
  })

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function refreshSessionAccessToken() {
  const session = await useAppSession()
  const refreshToken = session.data.refreshToken
  if (!refreshToken) {
    return null
  }

  const tokens = await postAuthRefresh({
    body: { refreshToken },
    baseUrl: process.env.VITE_API_BASE,
  })

  if (tokens.error || !tokens.data) {
    await session.clear()
    return null
  }

  await session.update({
    ...tokens.data,
  })

  return tokens.data.accessToken
}

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useAppSession()
  const accessToken = session.data.accessToken

  if (accessToken) {
    await postAuthLogout({
      body: {},
      headers: { ...authHeader(accessToken) },
      baseUrl: process.env.VITE_API_BASE,
    })
  }

  await session.clear()
  throw redirect({ to: "/" })
})

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await useAppSession()
    if (!session.data.accessToken) {
      const refreshedAccessToken = await refreshSessionAccessToken()
      if (!refreshedAccessToken) {
        return null
      }

      const refreshedMe = await getMe({
        headers: { ...authHeader(refreshedAccessToken) },
        baseUrl: process.env.VITE_API_BASE,
      })

      if (refreshedMe.error) {
        return null
      }

      return {
        ...refreshedMe.data!,
        accessToken: refreshedAccessToken,
      }
    }

    const me = await getMe({
      headers: { ...authHeader(session.data.accessToken!) },
      baseUrl: process.env.VITE_API_BASE,
    })
    if (!me.error) {
      return {
        ...me.data!,
        accessToken: session.data.accessToken!,
      }
    }

    const refreshedAccessToken = await refreshSessionAccessToken()
    if (!refreshedAccessToken) {
      return null
    }

    const refreshedMe = await getMe({
      headers: { ...authHeader(refreshedAccessToken) },
      baseUrl: process.env.VITE_API_BASE,
    })

    if (refreshedMe.error) {
      return null
    }

    return {
      ...refreshedMe.data!,
      accessToken: refreshedAccessToken,
    }
  }
)
