import { createFileRoute } from "@tanstack/react-router"
// import { Button } from "@/components/ui/button"
// import { useQuery } from "@tanstack/react-query"

export const Route = createFileRoute("/")({ component: App })

// function AuthInfo() {
//   const { data, isLoading } = useQuery({
//     queryFn: () => 0,
//     queryKey: ["authInfo"],
//   })

//   if (isLoading) {
//     return <div>Loading...</div>
//   }

//   return <div>{data}</div>
// }

// function App() {
//   return (
//     <div className="flex min-h-svh p-6">
//       <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
//         <div>
//           <h1 className="font-medium">Project ready!</h1>
//           <a href="/api/auth/login/github">Login with GitHub</a>
//           <a href="/api/auth/login/discord">Login with Discord</a>
//           <p>You may now add components and start building.</p>
//           <p>We&apos;ve already added the button component for you.</p>
//           <Button className="mt-2">Button</Button>
//           <AuthInfo />
//         </div>
//       </div>
//     </div>
//   )
// }

function App() {
  return (
    <div className="flex min-h-svh p-6">
      <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col items-center justify-center gap-8">
        <h1 className="text-6xl font-bold">RiftBench - WIP</h1>
        <p>&copy; Ozoku {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
