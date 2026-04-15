import { Link } from "react-router-dom"
import { Button } from "@/components/ui"
import { APP_NAME, ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"

export function Navbar() {
  const { isAuthenticated, isAdmin, signOut } = useAuth()

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 hidden md:flex">
          <Link to={ROUTES.HOME} className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              to={ROUTES.PRODUCTS}
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Produtos
            </Link>
            {isAuthenticated ? (
              <Link
                to={ROUTES.DASHBOARD}
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                Minha Área
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Mobile menu button could go here */}
          </div>
          <nav className="flex items-center space-x-2">
            {!isAuthenticated ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to={ROUTES.LOGIN}>Entrar</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to={ROUTES.REGISTER}>Cadastrar</Link>
                </Button>
              </>
            ) : (
              <>
                {isAdmin ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to={ROUTES.ADMIN}>Admin</Link>
                  </Button>
                ) : null}
                <Button onClick={signOut} variant="secondary" size="sm">
                  Sair
                </Button>
              </>
            )}
          </nav>
        </div>
      </div>
    </nav>
  )
}