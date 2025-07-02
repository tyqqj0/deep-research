import React, { useState } from "react";
import { CircleHelp, MonitorDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePWAInstall } from "react-use-pwa-install";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpTipProps, VERSION } from "../types";

function HelpTip({ children, tip }: HelpTipProps) {
  const [open, setOpen] = useState<boolean>(false);
  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
    }, 2000);
  };

  return (
    <div className="flex items-center">
      <span className="flex-1">{children}</span>
      <TooltipProvider delayDuration={100}>
        <Tooltip open={open} onOpenChange={(opened) => setOpen(opened)}>
          <TooltipTrigger asChild>
            <CircleHelp
              className="cursor-help w-4 h-4 ml-1 opacity-50 max-sm:ml-0"
              onClick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                handleOpen();
              }}
            />
          </TooltipTrigger>
          <TooltipContent className="max-w-52">
            <p>{tip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

interface AboutTabProps {
  handleReset: () => void;
}

export function AboutTab({ handleReset }: AboutTabProps) {
  const { t } = useTranslation();
  const pwaInstall = usePWAInstall();

  const installPWA = () => {
    if (pwaInstall) {
      pwaInstall.install();
    }
  };

  return (
    <div className="space-y-4 min-h-[250px]">
      {/* PWA 安装 */}
      {pwaInstall ? (
        <div className="from-item">
          <Label className="from-label">
            <HelpTip tip={t("setting.PWATip")}>
              {t("setting.PWA")}
            </HelpTip>
          </Label>
          <Button
            className="form-field"
            type="button"
            variant="ghost"
            onClick={() => installPWA()}
          >
            <MonitorDown className="mr-1.5 h-4 w-4" />
            {t("setting.installlPWA")}
          </Button>
        </div>
      ) : null}

      {/* 版本信息 */}
      <div className="from-item">
        <Label className="from-label">{t("setting.version")}</Label>
        <div className="form-field text-center leading-9">
          {`v${VERSION}`}
          <small className="ml-1">
            (
            <a
              className="hover:underline hover:underline-offset-4 hover:text-blue-500"
              href="https://github.com/tyqqj0/deep-research.git"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("setting.checkForUpdate")}
            </a>
            )
          </small>
        </div>
      </div>

      {/* 项目信息 */}
      <div className="from-item">
        <Label className="from-label">{t("setting.about", "关于")}</Label>
        <div className="form-field space-y-2 text-sm text-muted-foreground">
          <p>
            Deep Research - 基于AI的深度研究工具
          </p>
          <p>
            支持多种AI模型和搜索引擎，帮助您进行全面的研究分析。
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href="https://github.com/tyqqj0/deep-research"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-xs"
            >
              GitHub
            </a>
            <a
              href="https://github.com/tyqqj0/deep-research/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-xs"
            >
              {t("setting.reportIssue", "反馈问题")}
            </a>
            <a
              href="https://github.com/tyqqj0/deep-research/wiki"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-xs"
            >
              {t("setting.documentation", "使用文档")}
            </a>
          </div>
        </div>
      </div>

      {/* 重置设置 */}
      <div className="from-item">
        <Label className="from-label">
          {t("setting.resetSetting")}
        </Label>
        <Button
          className="form-field hover:text-red-500"
          type="button"
          variant="ghost"
          onClick={() => handleReset()}
        >
          {t("setting.resetAllSettings")}
        </Button>
      </div>

      {/* 构建信息 */}
      <div className="from-item">
        <Label className="from-label">{t("setting.buildInfo", "构建信息")}</Label>
        <div className="form-field space-y-1 text-xs text-muted-foreground">
          <div>
            {t("setting.buildTime", "构建时间")}: {new Date().toLocaleString()}
          </div>
          <div>
            React: {React.version}
          </div>
          <div>
            Next.js: 15.x
          </div>
        </div>
      </div>
    </div>
  );
}