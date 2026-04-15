import { APP_NAME } from "@/lib/constants"

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Construído com ❤️ pela equipe {APP_NAME}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <p className="text-sm text-muted-foreground">
            © 2024 {APP_NAME}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}