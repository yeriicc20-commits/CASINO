# Cómo subir tu proyecto de Unity para que pueda trabajar en él

Son cinco minutos y se hace una sola vez. A partir de ahí trabajo dentro de
tu proyecto y te dejo los cambios hechos, como con la web.

---

## 1. Crea el repositorio en GitHub

Entra en <https://github.com/new>:

- **Repository name**: el que quieras, por ejemplo `casino-unity`
- Marca **Private** si no quieres que lo vea nadie (me da igual, puedo
  trabajar en privado)
- **NO** marques "Add a README", "Add .gitignore" ni "Choose a license" —
  déjalo completamente vacío
- Pulsa **Create repository**

GitHub te enseñará una URL tipo `https://github.com/yeriicc20-commits/casino-unity.git`.
Guárdala.

---

## 2. Prepara el `.gitignore`

**Esto importa**: un proyecto de Unity tiene carpetas que pesan gigas y que
NO deben subirse (`Library/`, `Temp/`, `Build/`…). Unity las regenera solo.

Crea un fichero llamado `.gitignore` en la **raíz** de tu proyecto (al lado
de las carpetas `Assets/` y `ProjectSettings/`) con este contenido:

```gitignore
# Carpetas que Unity regenera: nunca se suben
[Ll]ibrary/
[Tt]emp/
[Oo]bj/
[Bb]uild/
[Bb]uilds/
[Ll]ogs/
[Uu]ser[Ss]ettings/
[Mm]emoryCaptures/
[Rr]ecordings/

# Ficheros de los IDE
.vs/
.vscode/
.idea/
*.csproj
*.unityproj
*.sln
*.user
*.suo
*.userprefs
*.pidb
*.booproj
*.svd
*.pdb
*.mdb
*.opendb
*.VC.db

# Compilaciones y paquetes
*.apk
*.aab
*.unitypackage
*.app
ExportedObj/
/[Aa]ssets/[Ss]treamingAssets/aa.meta
/[Aa]ssets/[Ss]treamingAssets/aa/*

# Cachés de crash
sysinfo.txt
crashlytics-build.properties

# Sistema operativo
.DS_Store
Thumbs.db
```

---

## 3. Sube el proyecto

Abre una terminal **en la carpeta raíz de tu proyecto de Unity** (la que
contiene `Assets/` y `ProjectSettings/`) y ejecuta, línea a línea:

```bash
git init
git add .
git commit -m "Proyecto de Unity inicial"
git branch -M main
git remote add origin https://github.com/yeriicc20-commits/casino-unity.git
git push -u origin main
```

Cambia la URL del `remote add` por la tuya.

Si te pide usuario y contraseña, la contraseña **no** es la de tu cuenta: es
un *token*. Se saca en <https://github.com/settings/tokens> → *Generate new
token (classic)* → marca la casilla **repo** → copia el token y pégalo como
contraseña.

---

## 4. Dime el nombre

Cuando termine, escríbeme sólo esto:

> ya está subido, se llama `casino-unity`

Yo lo adjunto a mi sesión, lo abro, miro cómo lo tienes montado (versión de
Unity, si usas uGUI o UI Toolkit, qué hay hecho ya) y me pongo con la
interfaz. Los cambios te los dejo en una rama, igual que con la web.

---

## ¿Y si no quieres subirlo?

Entonces la interfaz tiene que hacerla la IA que trabaje en tu ordenador.
Pásale el texto de `PROMPT-PARA-TU-IA.md`: le dice que la lógica ya está
hecha y verificada, que no la toque, y que sólo construya la capa visual
encima.

Ten en cuenta que esa IA tampoco puede ver lo que hay en este repositorio a
menos que se lo clone: el prompt ya lleva la URL y la rama.

---

## Por si acaso: comprobar que el proyecto está completo

Antes de subirlo, asegúrate de que en la raíz tienes al menos:

```
Assets/
ProjectSettings/
Packages/
```

Si falta `ProjectSettings/` o `Packages/`, no es la raíz del proyecto:
sube un nivel y vuelve a mirar.
