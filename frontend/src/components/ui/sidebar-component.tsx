import React, { useEffect, useRef, useState } from "react";
import {
  Search as SearchIcon,
  ChevronDown as ChevronDownIcon,
  User as UserIcon,
  OverflowMenuHorizontal,
  Logout as LogoutIcon,
} from "@carbon/icons-react";

import { cn } from "@/lib/utils";

/**
 * İki seviyeli kenar çubuğu: solda dar ikon rayı, sağda genişleyip daralan
 * detay paneli. Tamamen presentational — içerik prop olarak verilir, komponent
 * hiçbir veri kaynağı bilmez.
 */

/* --------------------------------- Types --------------------------------- */

export interface SidebarMenuItem {
  id?: string;
  icon?: React.ReactNode;
  label: string;
  /** Sağda gösterilen küçük sayaç: okunmamış mesaj, sesli kanaldaki kişi vb. */
  badge?: string | number;
  isActive?: boolean;
  children?: SidebarMenuItem[];
  onSelect?: () => void;
}

export interface SidebarSection {
  title: string;
  items: SidebarMenuItem[];
}

export interface SidebarPanel {
  title: string;
  sections: SidebarSection[];
}

export interface SidebarRailItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  /** Bu öğenin üstüne ayırıcı çizgi koyar (ör. sohbetler ile odaları ayırmak). */
  separatorBefore?: boolean;
}

export type PresenceStatus = "online" | "idle" | "dnd" | "offline";

export interface SidebarUser {
  name: string;
  avatarUrl?: string;
  status?: PresenceStatus;
  onLogout?: () => void;
}

export interface TwoLevelSidebarProps {
  brand: { name: string; logo?: React.ReactNode };
  railItems: SidebarRailItem[];
  /** Rayın altına sabitlenen öğeler (ayarlar vb.). */
  railFooterItems?: SidebarRailItem[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  panel: SidebarPanel;
  user?: SidebarUser;
  searchPlaceholder?: string;
  /** Kontrollü arama. Verilmezse komponent kendi state'ini tutar. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Kullanıcı satırının üstünde gösterilir (ör. ses kontrol çubuğu). */
  footer?: React.ReactNode;
  className?: string;
}

/* -------------------------------- Styling -------------------------------- */

// Yumuşak yay eğrisi — açılma/kapanma hareketi için.
const softSpringEasing = "cubic-bezier(0.25, 1.1, 0.4, 1)";
const springStyle = { transitionTimingFunction: softSpringEasing } as const;

const presenceColor: Record<PresenceStatus, string> = {
  online: "bg-emerald-500",
  idle: "bg-amber-400",
  dnd: "bg-red-500",
  offline: "bg-neutral-600",
};

/* --------------------------------- Avatar -------------------------------- */

function AvatarCircle({
  avatarUrl,
  name,
  status,
}: {
  avatarUrl?: string;
  name?: string;
  status?: PresenceStatus;
}) {
  return (
    <div className="relative rounded-full shrink-0 size-8 bg-black">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name ?? ""}
          className="size-8 rounded-full object-cover"
        />
      ) : (
        <div className="flex items-center justify-center size-8">
          <UserIcon size={16} className="text-neutral-50" />
        </div>
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full border border-neutral-800 pointer-events-none"
      />
      {status && (
        <span
          aria-label={status}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-black",
            presenceColor[status],
          )}
        />
      )}
    </div>
  );
}

/* ------------------------------ Search Input ----------------------------- */

function SearchContainer({
  placeholder = "Ara...",
  value,
  onChange,
}: {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [internalValue, setInternalValue] = useState("");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const handleChange = (next: string) => {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
  };

  return (
    <div className="relative shrink-0 w-full">
      <div className="bg-black h-10 relative rounded-lg flex items-center w-full">
        <div className="flex items-center justify-center shrink-0 px-1">
          <div className="size-8 flex items-center justify-center">
            <SearchIcon size={16} className="text-neutral-50" />
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div className="flex flex-col justify-center size-full">
            <div className="flex flex-col gap-2 items-start justify-center pr-2 py-1 w-full">
              <input
                type="text"
                placeholder={placeholder}
                value={currentValue}
                onChange={(e) => handleChange(e.target.value)}
                className="w-full bg-transparent border-none outline-none font-lexend text-[14px] text-neutral-50 placeholder:text-neutral-400 leading-[20px]"
              />
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-lg border border-neutral-800 pointer-events-none"
        />
      </div>
    </div>
  );
}

/* ---------------------------- Left Icon Nav Rail -------------------------- */

function IconNavButton({
  children,
  label,
  badge,
  isActive = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  badge?: number;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
      style={springStyle}
      className={cn(
        "relative flex items-center justify-center rounded-lg size-10 min-w-10 transition-colors duration-500",
        isActive
          ? "bg-neutral-800 text-neutral-50"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300",
      )}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] font-lexend font-semibold text-white flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function IconRail({
  brand,
  items,
  footerItems,
  activeSection,
  onSectionChange,
  user,
}: {
  brand: TwoLevelSidebarProps["brand"];
  items: SidebarRailItem[];
  footerItems: SidebarRailItem[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  user?: SidebarUser;
}) {
  return (
    // px-2 (p-4 degil): ray 64px, butonlar 40px. Yatay dolgu 16px oldugunda
    // ic genislik 32px'e dusuyor ve butonlar tasiyordu. Butonlar items-center
    // ile ortalandigi icin gorunum ayni, yalnizca tasma bitiyor.
    <nav
      aria-label={brand.name}
      className="bg-black flex flex-col gap-2 items-center px-2 py-4 w-16 h-full border-r border-neutral-800 rounded-l-2xl"
    >
      <div className="mb-2 size-10 flex items-center justify-center shrink-0">
        <div className="size-7 flex items-center justify-center">{brand.logo}</div>
      </div>

      {/* overflow-x acikca kapatildi: overflow-y-auto tek basina birakilirsa
          CSS diger ekseni de auto'ya cevirir ve kucuk bir tasmada bile yatay
          cubuk cikar. */}
      <div className="flex flex-col gap-2 w-full items-center overflow-y-auto overflow-x-hidden">
        {items.map((item) => (
          <React.Fragment key={item.id}>
            {item.separatorBefore && (
              <div aria-hidden="true" className="w-8 h-px bg-neutral-800 my-1 shrink-0" />
            )}
            <IconNavButton
              label={item.label}
              badge={item.badge}
              isActive={activeSection === item.id}
              onClick={() => onSectionChange(item.id)}
            >
              {item.icon}
            </IconNavButton>
          </React.Fragment>
        ))}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-2 w-full items-center shrink-0">
        {footerItems.map((item) => (
          <IconNavButton
            key={item.id}
            label={item.label}
            badge={item.badge}
            isActive={activeSection === item.id}
            onClick={() => onSectionChange(item.id)}
          >
            {item.icon}
          </IconNavButton>
        ))}
        {user && (
          <AvatarCircle
            avatarUrl={user.avatarUrl}
            name={user.name}
            status={user.status}
          />
        )}
      </div>
    </nav>
  );
}

/* ------------------------------ Menu Elements ---------------------------- */

function MenuItem({
  item,
  isExpanded,
  onToggle,
}: {
  item: SidebarMenuItem;
  isExpanded?: boolean;
  onToggle?: () => void;
}) {
  const hasChildren = Boolean(item.children?.length);

  const handleClick = () => {
    if (hasChildren && onToggle) onToggle();
    else item.onSelect?.();
  };

  return (
    <div className="relative shrink-0 w-full">
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={hasChildren ? isExpanded : undefined}
        className={cn(
          "rounded-lg cursor-pointer transition-colors flex items-center relative text-left w-full h-10 px-4 py-2",
          item.isActive ? "bg-neutral-800" : "hover:bg-neutral-800",
        )}
      >
        <div className="flex items-center justify-center shrink-0">{item.icon}</div>

        <div className="flex-1 relative overflow-hidden ml-3">
          <div className="font-lexend text-[14px] text-neutral-50 leading-[20px] truncate">
            {item.label}
          </div>
        </div>

        {item.badge !== undefined && (
          <span className="ml-2 shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-neutral-700 text-[11px] font-lexend text-neutral-200 flex items-center justify-center">
            {item.badge}
          </span>
        )}

        {hasChildren && (
          <div className="flex items-center justify-center shrink-0 ml-2">
            <ChevronDownIcon
              size={16}
              className="text-neutral-50 transition-transform duration-500"
              style={{
                ...springStyle,
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </div>
        )}
      </button>
    </div>
  );
}

function SubMenuItem({ item }: { item: SidebarMenuItem }) {
  return (
    <div className="w-full pl-9 pr-1 py-[1px]">
      <button
        type="button"
        onClick={item.onSelect}
        className={cn(
          "h-10 w-full rounded-lg cursor-pointer transition-colors flex items-center gap-2 px-3 py-1 text-left",
          item.isActive ? "bg-neutral-800" : "hover:bg-neutral-800",
        )}
      >
        {item.icon && <span className="shrink-0">{item.icon}</span>}
        <span className="flex-1 min-w-0 font-lexend text-[14px] text-neutral-300 leading-[18px] truncate">
          {item.label}
        </span>
        {item.badge !== undefined && (
          <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-neutral-700 text-[11px] font-lexend text-neutral-200 flex items-center justify-center">
            {item.badge}
          </span>
        )}
      </button>
    </div>
  );
}

function MenuSection({
  section,
  expandedItems,
  onToggleExpanded,
}: {
  section: SidebarSection;
  expandedItems: Set<string>;
  onToggleExpanded: (itemKey: string) => void;
}) {
  return (
    <div className="flex flex-col w-full">
      <div className="relative shrink-0 w-full h-10">
        <div className="flex items-center h-10 px-4">
          <div className="font-lexend text-[14px] text-neutral-400">{section.title}</div>
        </div>
      </div>

      {section.items.map((item, index) => {
        const itemKey = item.id ?? `${section.title}-${index}`;
        const isExpanded = expandedItems.has(itemKey);
        return (
          <div key={itemKey} className="w-full flex flex-col">
            <MenuItem
              item={item}
              isExpanded={isExpanded}
              onToggle={() => onToggleExpanded(itemKey)}
            />
            {isExpanded && item.children && (
              <div className="flex flex-col gap-1 mb-2">
                {item.children.map((child, childIndex) => (
                  <SubMenuItem key={child.id ?? `${itemKey}-${childIndex}`} item={child} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ Detail Panel ----------------------------- */

function PanelTitle({ title }: { title: string }) {
  return (
    <div className="w-full overflow-hidden">
      <div className="flex items-center h-10 min-w-0">
        <div className="px-2 py-1 min-w-0">
          <div className="font-lexend font-semibold text-[18px] text-neutral-50 leading-[27px] truncate">
            {title}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- User Bar -------------------------------- */

/**
 * Kullanici satiri ve acilir menusu. Uc nokta butonu dogrudan cikis yapmak
 * yerine menuyu acar: cikis geri alinamayan bir islem, tek yanlis tiklamayla
 * tetiklenmemeli.
 */
function UserBar({ user }: { user: SidebarUser }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative w-full mt-auto pt-2 border-t border-neutral-800 shrink-0"
    >
      {open && (
        <div
          role="menu"
          aria-label="Hesap islemleri"
          className="absolute bottom-full left-1 right-1 z-20 mb-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-lg shadow-black/60"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              user.onLogout?.();
            }}
            className="w-full h-9 flex items-center gap-2 rounded-md px-3 text-left font-lexend text-[14px] text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogoutIcon size={16} className="shrink-0" />
            Çıkış yap
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 px-2 py-2">
        <AvatarCircle avatarUrl={user.avatarUrl} name={user.name} status={user.status} />
        <div className="font-lexend text-[14px] text-neutral-50 truncate">{user.name}</div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Kullanıcı menüsü"
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            "ml-auto size-8 rounded-md flex items-center justify-center shrink-0 transition-colors",
            open
              ? "bg-neutral-800 text-neutral-200"
              : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
          )}
        >
          <OverflowMenuHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Root ---------------------------------- */

export function TwoLevelSidebar({
  brand,
  railItems,
  railFooterItems = [],
  activeSection,
  onSectionChange,
  panel,
  user,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  footer,
  className,
}: TwoLevelSidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (itemKey: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  };

  return (
    <div className={cn("flex flex-row h-full", className)}>
      <IconRail
        brand={brand}
        items={railItems}
        footerItems={railFooterItems}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        user={user}
      />

      <aside className="bg-black flex flex-col gap-4 items-start p-4 rounded-r-2xl h-full w-[22rem]">
        <div className="relative shrink-0 w-full">
          <div className="flex items-center p-1 w-full">
            <div className="h-10 w-8 flex items-center justify-center pl-2">
              {brand.logo}
            </div>
            <div className="px-2 py-1">
              <div className="font-lexend font-semibold text-[16px] text-neutral-50">
                {brand.name}
              </div>
            </div>
          </div>
        </div>

        <PanelTitle title={panel.title} />

        <SearchContainer
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={onSearchChange}
        />

        <div className="flex flex-col w-full flex-1 min-h-0 overflow-y-auto gap-4 items-start">
          {panel.sections.map((section, index) => (
            <MenuSection
              key={`${activeSection}-${section.title}-${index}`}
              section={section}
              expandedItems={expandedItems}
              onToggleExpanded={toggleExpanded}
            />
          ))}
        </div>

        {footer && <div className="w-full shrink-0 px-1">{footer}</div>}

        {user && <UserBar user={user} />}
      </aside>
    </div>
  );
}

export default TwoLevelSidebar;
