import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge"; // Badge component not available
import { X, Plus } from "lucide-react";
import { PREDEFINED_DOMAINS } from "../types";

interface DomainLimitConfigProps {
  predefinedDomains: string[];
  customDomains: string[];
  onPredefinedChange: (domains: string[]) => void;
  onCustomChange: (domains: string[]) => void;
  label?: string;
  className?: string;
}

export const DomainLimitConfig: React.FC<DomainLimitConfigProps> = ({
  predefinedDomains,
  customDomains,
  onPredefinedChange,
  onCustomChange,
  label,
  className = "",
}) => {
  const { t } = useTranslation();
  const [newDomain, setNewDomain] = useState("");

  const handlePredefinedToggle = (domain: string, checked: boolean) => {
    if (checked) {
      onPredefinedChange([...predefinedDomains, domain]);
    } else {
      onPredefinedChange(predefinedDomains.filter(d => d !== domain));
    }
  };

  const handleAddCustomDomain = () => {
    if (newDomain.trim() && !customDomains.includes(newDomain.trim())) {
      onCustomChange([...customDomains, newDomain.trim()]);
      setNewDomain("");
    }
  };

  const handleRemoveCustomDomain = (domain: string) => {
    onCustomChange(customDomains.filter(d => d !== domain));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomDomain();
    }
  };

  // 获取所有预定义域名
  const getAllPredefinedDomains = () => {
    return Object.values(PREDEFINED_DOMAINS).flat();
  };

  const allDomains = getAllPredefinedDomains();

  return (
    <div className={`space-y-4 ${className}`}>
      {label && (
        <FormLabel className="from-label text-base font-medium">
          {label}
        </FormLabel>
      )}
      
      {/* 预定义域名选择 */}
      <div className="space-y-2">
        <FormLabel className="text-sm font-medium">
          {t("setting.predefinedDomains")}
        </FormLabel>
        <div className="grid grid-cols-1 gap-y-2 md:grid-cols-2 md:gap-x-8 max-h-48 overflow-y-auto">
          {allDomains.map((domain) => (
            <FormItem key={domain} className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={predefinedDomains.includes(domain)}
                  onCheckedChange={(checked: boolean) => {
                    handlePredefinedToggle(domain, checked);
                  }}
                />
              </FormControl>
              <FormLabel className="text-sm font-normal cursor-pointer">
                {domain}
              </FormLabel>
            </FormItem>
          ))}
        </div>
      </div>

      {/* 自定义域名管理 */}
      <div className="space-y-2">
        <FormLabel className="text-sm font-medium">
          {t("setting.customDomains")}
        </FormLabel>
        
        {/* 添加自定义域名 */}
        <div className="flex gap-2">
          <Input
            placeholder={t("setting.addCustomDomainPlaceholder")}
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddCustomDomain}
            disabled={!newDomain.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* 已添加的自定义域名 */}
        {customDomains.length > 0 && (
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {customDomains.map((domain, index) => (
              <div key={index} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs">
                <span>{domain}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomDomain(domain)}
                  className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DomainLimitConfig;