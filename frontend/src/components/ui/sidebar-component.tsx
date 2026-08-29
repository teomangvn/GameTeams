import React, { useState } from "react";
import {
  Search as SearchIcon,
  ChevronDown as ChevronDownIcon,
  User as UserIcon,
  OverflowMenuHorizontal,
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
  onMenuClick?: () => void;
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
  defaultCollapsed?: boolean;
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
  isCollapsed = false,
  placeholder = "Ara...",
  value,
  onChange,
}: {
  isCollapsed?: boolean;
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
    <div
      className={cn(
        "relative shrink-0 transition-all duration-500 w-full",
        isCollapsed && "flex justify-center",
      )}
      style={springStyle}
    >
      <div
        className={cn(
          "bg-black h-10 relative rounded-lg flex items-center transition-all duration-500",
          isCollapsed ? "w-10 min-w-10 justify-center" : "w-full",
        )}
        style={springStyle}
      >
        <div
          className={cn(
            "flex items-center justify-center shrink-0 transition-all duration-500",
            isCollapsed ? "p-1" : "px-1",
          )}
          style={springStyle}
        >
          <div className="size-8 flex items-center justify-center">
            <SearchIcon size={16} className="text-neutral-50" />
          </div>
        </div>

        <div
          className={cn(
            "flex-1 relative transition-opacity duration-500 overflow-hidden",
            isCollapsed ? "opacity-0 w-0" : "opacity-100",
          )}
          style={springStyle}
        >
          <div className="flex flex-col justify-center size-full">
            <div className="flex flex-col gap-2 items-start justify-center pr-2 py-1 w-full">
              <input
                type="text"
                placeholder={placeholder}
                value={currentValue}
                onChange={(e) => handleChange(e.target.value)}
                className="w-full bg-transparent border-none outline-none font-lexend text-[14px] text-neutral-50 placeholder:text-neutral-400 leading-[20px]"
                tabIndex={isCollapsed ? -1 : 0}
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
    <nav
      aria-label={brand.name}
      className="bg-black flex flex-col gap-2 items-center p-4 w-16 h-full border-r border-neutral-800 rounded-l-2xl"
    >
      <div className="mb-2 size-10 flex items-center justify-center shrink-0">
        <div className="size-7 flex items-center justify-center">{brand.logo}</div>
      </div>

      <div className="flex flex-col gap-2 w-full items-center overflow-y-auto">
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
  isCollapsed,
}: {
  item: SidebarMenuItem;
  isExpanded?: boolean;
  onToggle?: () => void;
  isCollapsed?: boolean;
}) {
  const hasChildren = Boolean(item.children?.length);

  const handleClick = () => {
    if (hasChildren && onToggle) onToggle();
    else item.onSelect?.();
  };

  return (
    <div
      className={cn(
        "relative shrink-0 transition-all duration-500 w-full",
        isCollapsed && "flex justify-center",
      )}
      style={springStyle}
    >
      <button
        type="button"
        onClick={handleClick}
        title={isCollapsed ? item.label : undefined}
        aria-expanded={hasChildren ? isExpanded : undefined}
        style={springStyle}
        className={cn(
          "rounded-lg cursor-pointer transition-all duration-500 flex items-center relative text-left",
          item.isActive ? "bg-neutral-800" : "hover:bg-neutral-800",
          isCollapsed
            ? "w-10 min-w-10 h-10 justify-center p-4"
            : "w-full h-10 px-4 py-2",
        )}
      >
        <div className="flex items-center justify-center shrink-0">{item.icon}</div>

        <div
          className={cn(
            "flex-1 relative transition-opacity duration-500 overflow-hidden",
            isCollapsed ? "opacity-0 w-0" : "opacity-100 ml-3",
          )}
          style={springStyle}
        >
          <div className="font-lexend text-[14px] text-neutral-50 leading-[20px] truncate">
            {item.label}
          </div>
        </div>

        {item.badge !== undefined && !isCollapsed && (
          <span className="ml-2 shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-neutral-700 text-[11px] font-lexend text-neutral-200 flex items-center justify-center">
            {item.badge}
          </span>
        )}

        {hasChildren && (
          <div
            className={cn(
              "flex items-center justify-center shrink-0 transition-opacity duration-500",
              isCollapsed ? "opacity-0 w-0" : "opacity-100 ml-2",
            )}
            style={springStyle}
          >
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
  isCollapsed,
}: {
  section: SidebarSection;
  expandedItems: Set<string>;
  onToggleExpanded: (itemKey: string) => void;
  isCollapsed?: boolean;
}) {
  return (
    <div className="flex flex-col w-full">
      <div
        className={cn(
          "relative shrink-0 w-full transition-all duration-500 overflow-hidden",
          isCollapsed ? "h-0 opacity-0" : "h-10 opacity-100",
        )}
        style={springStyle}
      >
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
              isCollapsed={isCollapsed}
            />
            {isExpanded && item.children && !isCollapsed && (
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

function PanelTitle({
  title,
  onToggleCollapse,
  isCollapsed,
}: {
  title: string;
  onToggleCollapse: () => void;
  isCollapsed: boolean;
}) {
  if (isCollapsed) {
    return (
      <div className="w-full flex justify-center transition-all duration-500" style={springStyle}>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Paneli genişlet"
          style={springStyle}
          className="flex items-center justify-center rounded-lg size-10 min-w-10 transition-all duration-500 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300"
        >
          <ChevronDownIcon size={16} className="-rotate-90 scale-x-[-1]" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden transition-all duration-500" style={springStyle}>
      <div className="flex items-center justify-between">
        <div className="flex items-center h-10 min-w-0">
          <div className="px-2 py-1 min-w-0">
            <div className="font-lexend font-semibold text-[18px] text-neutral-50 leading-[27px] truncate">
              {title}
            </div>
          </div>
        </div>
        <div className="pr-1 shrink-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Paneli daralt"
            style={springStyle}
            className="flex items-center justify-center rounded-lg size-10 min-w-10 transition-all duration-500 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300"
          >
            <ChevronDownIcon size={16} className="rotate-90" />
          </button>
        </div>
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
  defaultCollapsed = false,
  className,
}: TwoLevelSidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

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

      <aside
        style={springStyle}
        className={cn(
          "bg-black flex flex-col gap-4 items-start p-4 rounded-r-2xl transition-all duration-500 h-full",
          isCollapsed ? "w-16 min-w-16 px-0" : "w-80",
        )}
      >
        {!isCollapsed && (
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
        )}

        <PanelTitle
          title={panel.title}
          onToggleCollapse={() => setIsCollapsed((s) => !s)}
          isCollapsed={isCollapsed}
        />

        <SearchContainer
          isCollapsed={isCollapsed}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={onSearchChange}
        />

        <div
          style={springStyle}
          className={cn(
            "flex flex-col w-full flex-1 min-h-0 overflow-y-auto transition-all duration-500",
            isCollapsed ? "gap-2 items-center" : "gap-4 items-start",
          )}
        >
          {panel.sections.map((section, index) => (
            <MenuSection
              key={`${activeSection}-${section.title}-${index}`}
              section={section}
              expandedItems={expandedItems}
              onToggleExpanded={toggleExpanded}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        {!isCollapsed && footer && (
          <div className="w-full shrink-0 px-1">{footer}</div>
        )}

        {!isCollapsed && user && (
          <div className="w-full mt-auto pt-2 border-t border-neutral-800 shrink-0">
            <div className="flex items-center gap-2 px-2 py-2">
              <AvatarCircle
                avatarUrl={user.avatarUrl}
                name={user.name}
                status={user.status}
              />
              <div className="font-lexend text-[14px] text-neutral-50 truncate">
                {user.name}
              </div>
              <button
                type="button"
                onClick={user.onMenuClick}
                aria-label="Kullanıcı menüsü"
                className="ml-auto size-8 rounded-md flex items-center justify-center text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 shrink-0"
              >
                <OverflowMenuHorizontal size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default TwoLevelSidebar;
