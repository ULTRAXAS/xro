TERMUX_PKG_HOMEPAGE="https://ultraxas.com"
TERMUX_PKG_DESCRIPTION="Xro 8.6 Autonomous AI coding agent CLI by ULTRAXAS"
TERMUX_PKG_LICENSE="Apache-2.0"
TERMUX_PKG_MAINTAINER="ULTRAXAS <contact@ultraxas.com>"
TERMUX_PKG_VERSION="3.0.0"
TERMUX_PKG_SRCURL="https://ultraxas.com/termux/xro_${TERMUX_PKG_VERSION}_all.deb"
TERMUX_PKG_SHA256="bc10882bdbedf0a553aff4a6813152382b3b9bea03c6ac995c6df515a5e82dea"
TERMUX_PKG_DEPENDS="bun"
TERMUX_PKG_BUILD_IN_SRC=true
TERMUX_PKG_PLATFORM_INDEPENDENT=true

termux_step_make_install() {
	ar x "${TERMUX_PKG_BUILDDIR}/xro_${TERMUX_PKG_VERSION}_all.deb" data.tar.xz
	tar -xf data.tar.xz -C "${TERMUX_PREFIX}/../"
}
