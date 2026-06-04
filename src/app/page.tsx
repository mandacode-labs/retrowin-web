"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCreateSystem, useLogout, useSystems, useUser } from "@/api/hooks";
import { XPImageIcons } from "@/components/icons/xp_image_icons";
import styles from "./page.module.css";

export default function SystemSelectionPage() {
  const router = useRouter();
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [systemName, setSystemName] = useState("");
  const [systemDescription, setSystemDescription] = useState("");

  // Auth check
  const getUserQuery = useUser();

  // Check if user is authenticated
  const isAuthenticated = getUserQuery.data?.status === 200;

  // Logout mutation
  const logoutMutation = useLogout();

  // Get systems list (only when authenticated)
  const listSystemsQuery = useSystems(isAuthenticated);

  // Create system mutation
  const createSystemMutation = useCreateSystem();

  // Handle create system success
  useEffect(() => {
    if (createSystemMutation.isSuccess) {
      setIsCreateMode(false);
      setSystemName("");
      setSystemDescription("");
    }
  }, [createSystemMutation.isSuccess]);

  // Handle system selection
  const handleSystemSelect = (systemId: string) => {
    router.push(`/${systemId}`);
  };

  // Handle create system
  const handleCreateSystem = () => {
    if (!systemName.trim()) return;

    createSystemMutation.mutate({
      data: {
        name: systemName.trim(),
        description: systemDescription.trim() || null,
      },
    });
  };

  // Handle cancel create
  const handleCancelCreate = () => {
    setIsCreateMode(false);
    setSystemName("");
    setSystemDescription("");
  };

  // Handle login click
  const handleLoginClick = () => {
    router.push("/login");
  };

  // Handle turn off click
  const handleTurnOffClick = () => {
    if (isAuthenticated) {
      logoutMutation.mutate();
    } else {
      handleLoginClick();
    }
  };

  // Loading state
  if (getUserQuery.isLoading || getUserQuery.isPending) {
    return (
      <div className={styles.xp_login}>
        <div className={styles.top_bar}></div>
        <p className={styles.loading_text}>Loading...</p>
        <div className={styles.bottom_bar}></div>
      </div>
    );
  }

  // Loading systems (only when authenticated)
  if (
    isAuthenticated &&
    (listSystemsQuery.isLoading || listSystemsQuery.isPending)
  ) {
    return (
      <div className={styles.xp_login}>
        <div className={styles.top_bar}></div>
        <p className={styles.loading_text}>Loading systems...</p>
        <div className={styles.bottom_bar}></div>
      </div>
    );
  }

  const systems = listSystemsQuery.data || [];

  return (
    <div className={styles.xp_login}>
      {/* Top dark blue bar */}
      <div className={styles.top_bar}></div>

      {/* Main content area with gradient */}
      <div className={styles.main_content}>
        {/* Left side - Branding */}
        <div className={styles.left_panel}>
          <div className={styles.windows_logo}>
            <svg
              viewBox="0 0 88 88"
              className={styles.logo_svg}
              role="img"
              aria-label="Windows Logo"
            >
              <title>Windows Logo</title>
              <path fill="#F25022" d="M0 0h42v42H0z" />
              <path fill="#00A4EF" d="M46 0h42v42H46z" />
              <path fill="#7FBA00" d="M0 46h42v42H0z" />
              <path fill="#FFB900" d="M46 46h42v42H46z" />
            </svg>
          </div>
          <h1 className={styles.welcome_title}>Welcome</h1>
          <p className={styles.welcome_hint}>
            {!isAuthenticated
              ? "Please log in to continue"
              : isCreateMode
                ? "Create a new system"
                : "Click a system to begin"}
          </p>
        </div>

        {/* Right side - User tiles or Create Form or Login */}
        <div className={styles.right_panel}>
          {!isAuthenticated ? (
            // Not authenticated - show login button
            <div className={styles.login_section}>
              <button
                className={styles.login_button}
                onClick={handleLoginClick}
                type="button"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="white"
                  width="32"
                  height="32"
                  role="img"
                  aria-label="User"
                >
                  <title>User</title>
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
                <span>Login</span>
              </button>
            </div>
          ) : isCreateMode ? (
            // Create mode - show form
            <div className={styles.create_form}>
              <div className={styles.form_group}>
                <label htmlFor="system-name" className={styles.form_label}>
                  System Name
                </label>
                <input
                  id="system-name"
                  type="text"
                  className={styles.form_input}
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  placeholder="Enter system name"
                  maxLength={255}
                  disabled={createSystemMutation.isPending}
                />
              </div>
              <div className={styles.form_group}>
                <label htmlFor="system-desc" className={styles.form_label}>
                  Description (optional)
                </label>
                <input
                  id="system-desc"
                  type="text"
                  className={styles.form_input}
                  value={systemDescription}
                  onChange={(e) => setSystemDescription(e.target.value)}
                  placeholder="Enter description"
                  maxLength={1000}
                  disabled={createSystemMutation.isPending}
                />
              </div>
              <div className={styles.form_buttons}>
                <button
                  className={styles.form_button_primary}
                  onClick={handleCreateSystem}
                  type="button"
                  disabled={
                    !systemName.trim() || createSystemMutation.isPending
                  }
                >
                  {createSystemMutation.isPending ? "Creating..." : "Create"}
                </button>
                <button
                  className={styles.form_button_secondary}
                  onClick={handleCancelCreate}
                  type="button"
                  disabled={createSystemMutation.isPending}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // Authenticated - show system tiles
            <div className={styles.user_tiles}>
              {systems.map((system) => (
                <button
                  key={system.id}
                  className={styles.user_tile}
                  onClick={() => handleSystemSelect(system.id)}
                  type="button"
                  aria-label={`Select ${system.name}`}
                >
                  <div className={styles.user_avatar}>
                    <XPImageIcons.Home />
                  </div>
                  <span className={styles.user_name}>{system.name}</span>
                </button>
              ))}
              <button
                className={styles.user_tile}
                onClick={() => setIsCreateMode(true)}
                type="button"
                aria-label="Add new system"
              >
                <div className={styles.user_avatar}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="white"
                    width="32"
                    height="32"
                    role="img"
                    aria-label="Add"
                  >
                    <title>Add</title>
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                </div>
                <span className={styles.user_name}>Add system</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom dark blue bar with power button */}
      <div className={styles.bottom_bar}>
        <button
          className={styles.power_button}
          onClick={handleTurnOffClick}
          type="button"
          disabled={logoutMutation.isPending}
          aria-label="Turn off computer"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            role="img"
            aria-label="Power"
          >
            <title>Power</title>
            <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z" />
          </svg>
          <span>
            {logoutMutation.isPending ? "Logging out..." : "Turn off"}
          </span>
        </button>
        <span className={styles.bottom_hint}>
          {!isAuthenticated
            ? "Click login to access your systems"
            : isCreateMode
              ? "Fill in the form to create a system"
              : "To begin, click your system"}
        </span>
      </div>
    </div>
  );
}
