import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, type Theme } from '@/hooks/useTheme';

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // `theme` pode ser undefined antes da hidratacao do next-themes; fallback em 'system'.
  const current = options.find(o => o.value === theme) ?? options[2];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // 4.1.3 / 1.4.1 - nome acessivel que tambem informa o tema vigente
          aria-label={`Tema: ${current.label}. Escolher tema`}
          title={`Tema: ${current.label}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <Icon size={17} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={v => setTheme(v as Theme)}>
          {options.map(o => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              <o.icon size={14} aria-hidden="true" />
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
