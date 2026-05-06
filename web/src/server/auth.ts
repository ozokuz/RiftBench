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

    console.log("Received tokens data from API:", tokens)

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

export const refreshTokenFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await useAppSession()
    if (!session.data.refreshToken) {
      throw new Error("No refresh token available")
    }

    const tokens = await postAuthRefresh({
      body: { refreshToken: session.data.refreshToken },
      baseUrl: process.env.VITE_API_BASE,
    })

    if (tokens.error || !tokens.data) {
      await session.clear()
      throw new Error("Failed to refresh token")
    }

    await session.update({
      ...tokens.data,
    })

    return { accessToken: tokens.data.accessToken }
  }
)

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useAppSession()
  await session.clear()
  await postAuthLogout({
    body: {},
    headers: { ...authHeader(session.data.accessToken!) },
    baseUrl: process.env.VITE_API_BASE,
  })
  throw redirect({ to: "/" })
})

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await useAppSession()
    const me = await getMe({
      headers: { ...authHeader(session.data.accessToken!) },
    })
    if (me.error) {
      return null
    }
    return {
      ...me.data!,
      accessToken: session.data.accessToken!,
    }
  }
)
