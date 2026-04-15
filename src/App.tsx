import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "react-router-dom"
import { InstallPrompt } from "@/components/common"
import { router } from "@/routes"

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <InstallPrompt />
    </QueryClientProvider>
  )
}

export default App
