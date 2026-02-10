import { useLanguage, LANGUAGES, Language } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'buttons' | 'select';
  showFlag?: boolean;
  showNativeName?: boolean;
  className?: string;
}

export function LanguageSwitcher({ 
  variant = 'dropdown', 
  showFlag = true, 
  showNativeName = true,
  className = ''
}: LanguageSwitcherProps) {
  const { language, setLanguage, languageInfo, t } = useLanguage();

  if (variant === 'buttons') {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {LANGUAGES.map((lang) => (
          <Button
            key={lang.code}
            variant={language === lang.code ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLanguage(lang.code)}
            className="gap-2"
          >
            {showFlag && <span>{lang.flag}</span>}
            <span>{showNativeName ? lang.nativeName : lang.name}</span>
          </Button>
        ))}
      </div>
    );
  }

  if (variant === 'select') {
    return (
      <div className={`grid grid-cols-2 gap-2 ${className}`}>
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              language === lang.code 
                ? 'border-primary bg-primary/10 text-primary' 
                : 'border-border hover:border-primary/50 hover:bg-muted'
            }`}
          >
            {showFlag && <span className="text-2xl">{lang.flag}</span>}
            <div className="flex flex-col items-start">
              <span className="font-medium">{lang.nativeName}</span>
              <span className="text-xs text-muted-foreground">{lang.name}</span>
            </div>
            {language === lang.code && (
              <Check className="w-4 h-4 ms-auto text-primary" />
            )}
          </button>
        ))}
      </div>
    );
  }

  // Default: dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={`gap-2 ${className}`}>
          <Globe className="w-4 h-4" />
          {showFlag && <span>{languageInfo.flag}</span>}
          <span>{showNativeName ? languageInfo.nativeName : languageInfo.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`gap-2 cursor-pointer ${language === lang.code ? 'bg-primary/10' : ''}`}
          >
            {showFlag && <span>{lang.flag}</span>}
            <span className="flex-1">{showNativeName ? lang.nativeName : lang.name}</span>
            {language === lang.code && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Compact language switcher for header/navbar
export function CompactLanguageSwitcher({ className = '' }: { className?: string }) {
  const { language, setLanguage, languageInfo } = useLanguage();

  const nextLanguage = (): Language => {
    const currentIndex = LANGUAGES.findIndex(l => l.code === language);
    const nextIndex = (currentIndex + 1) % LANGUAGES.length;
    return LANGUAGES[nextIndex].code;
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setLanguage(nextLanguage())}
      className={className}
      title={`${languageInfo.nativeName} - Click to change`}
    >
      <span className="text-lg">{languageInfo.flag}</span>
    </Button>
  );
}

export default LanguageSwitcher;
