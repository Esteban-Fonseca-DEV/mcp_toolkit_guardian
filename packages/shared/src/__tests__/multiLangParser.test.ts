import { describe, it, expect } from "vitest";
import { parseImportsMultiLang, detectLanguage, getSupportedExtensions, resolveLayerFromImport } from "../multiLangParser";

describe("multiLangParser", () => {
  describe("detectLanguage", () => {
    it("detects TypeScript", () => expect(detectLanguage("main.ts")).toBe("typescript"));
    it("detects TSX", () => expect(detectLanguage("App.tsx")).toBe("typescript"));
    it("detects JavaScript", () => expect(detectLanguage("index.js")).toBe("typescript"));
    it("detects JSX", () => expect(detectLanguage("App.jsx")).toBe("typescript"));
    it("detects Go", () => expect(detectLanguage("main.go")).toBe("go"));
    it("detects Python", () => expect(detectLanguage("app.py")).toBe("python"));
    it("detects Dart", () => expect(detectLanguage("main.dart")).toBe("dart"));
    it("detects Java", () => expect(detectLanguage("App.java")).toBe("java"));
    it("detects C#", () => expect(detectLanguage("Program.cs")).toBe("csharp"));
    it("detects Kotlin", () => expect(detectLanguage("Main.kt")).toBe("kotlin"));
    it("detects Kotlin script", () => expect(detectLanguage("build.kts")).toBe("kotlin"));
    it("detects Rust", () => expect(detectLanguage("main.rs")).toBe("rust"));
    it("returns null for unsupported", () => expect(detectLanguage("style.css")).toBeNull());
    it("returns null for no extension", () => expect(detectLanguage("Makefile")).toBeNull());
  });

  describe("getSupportedExtensions", () => {
    it("returns all supported extensions", () => {
      const exts = getSupportedExtensions();
      expect(exts).toContain(".ts");
      expect(exts).toContain(".go");
      expect(exts).toContain(".py");
      expect(exts).toContain(".dart");
      expect(exts).toContain(".java");
      expect(exts).toContain(".cs");
      expect(exts).toContain(".kt");
      expect(exts).toContain(".rs");
    });
  });

  describe("Go imports", () => {
    it("parses Go import block statements", () => {
      const content = `package main

import (
\t"fmt"
\t"myapp/internal/domain/user"
\t"myapp/infrastructure/database"
)

func main() {}`;
      const result = parseImportsMultiLang("main.go", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3);
      expect(result![0].targetModule).toBe("fmt");
      expect(result![1].targetModule).toBe("myapp/internal/domain/user");
      expect(result![2].targetModule).toBe("myapp/infrastructure/database");
    });

    it("parses Go single-line import", () => {
      const content = `package main

import "fmt"

func main() {}`;
      const result = parseImportsMultiLang("main.go", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].targetModule).toBe("fmt");
    });

    it("parses Go aliased imports", () => {
      const content = `package main

import (
\tdb "myapp/infrastructure/database"
)`;
      const result = parseImportsMultiLang("main.go", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].targetModule).toBe("myapp/infrastructure/database");
    });

    it("skips Go comments", () => {
      const content = `package main

// import "commented"
import "real"`;
      const result = parseImportsMultiLang("main.go", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].targetModule).toBe("real");
    });
  });

  describe("Python imports", () => {
    it("parses Python from-import statements", () => {
      const content = `from domain.entities.user import User
from infrastructure.repositories import UserRepository
import application.services.auth`;
      const result = parseImportsMultiLang("app.py", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3);
      expect(result![0].targetModule).toBe("domain.entities.user");
      expect(result![1].targetModule).toBe("infrastructure.repositories");
      expect(result![2].targetModule).toBe("application.services.auth");
    });

    it("skips Python comments", () => {
      const content = `# from fake import fake
from domain.models import User`;
      const result = parseImportsMultiLang("app.py", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].targetModule).toBe("domain.models");
    });
  });

  describe("Java imports", () => {
    it("parses Java import statements", () => {
      const content = `package com.myapp.domain.services;

import com.myapp.domain.entities.User;
import com.myapp.infrastructure.persistence.UserRepo;
import static com.myapp.utils.Constants.*;`;
      const result = parseImportsMultiLang("UserService.java", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3);
      expect(result![0].targetModule).toBe("com.myapp.domain.entities.User");
      expect(result![1].targetModule).toBe("com.myapp.infrastructure.persistence.UserRepo");
      expect(result![2].targetModule).toBe("com.myapp.utils.Constants.*");
    });

    it("skips Java comments", () => {
      const content = `// import com.fake.Fake;
import com.real.Real;`;
      const result = parseImportsMultiLang("Test.java", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].targetModule).toBe("com.real.Real");
    });
  });

  describe("Dart imports", () => {
    it("parses Dart import statements", () => {
      const content = `import 'package:myapp/domain/entities/user.dart';
import 'package:myapp/infrastructure/repos/user_repo.dart';
import 'dart:async';`;
      const result = parseImportsMultiLang("main.dart", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3);
      expect(result![0].targetModule).toBe("package:myapp/domain/entities/user.dart");
      expect(result![1].targetModule).toBe("package:myapp/infrastructure/repos/user_repo.dart");
      expect(result![2].targetModule).toBe("dart:async");
    });

    it("parses Dart export and part statements", () => {
      const content = `export 'package:myapp/public_api.dart';
part 'src/internal.dart';`;
      const result = parseImportsMultiLang("lib.dart", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(2);
      expect(result![0].targetModule).toBe("package:myapp/public_api.dart");
      expect(result![1].targetModule).toBe("src/internal.dart");
    });
  });

  describe("C# imports", () => {
    it("parses C# using statements", () => {
      const content = `using System;
using MyApp.Domain.Entities;
using MyApp.Infrastructure.Persistence;
using static MyApp.Utils.Constants;`;
      const result = parseImportsMultiLang("Program.cs", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(4);
      expect(result![0].targetModule).toBe("System");
      expect(result![1].targetModule).toBe("MyApp.Domain.Entities");
      expect(result![2].targetModule).toBe("MyApp.Infrastructure.Persistence");
      expect(result![3].targetModule).toBe("MyApp.Utils.Constants");
    });

    it("parses C# using alias", () => {
      const content = `using Repo = MyApp.Infrastructure.UserRepository;`;
      const result = parseImportsMultiLang("Service.cs", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].targetModule).toBe("MyApp.Infrastructure.UserRepository");
    });
  });

  describe("Kotlin imports", () => {
    it("parses Kotlin import statements", () => {
      const content = `package com.myapp.application

import com.myapp.domain.entities.User
import com.myapp.infrastructure.db.UserDao`;
      const result = parseImportsMultiLang("Service.kt", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(2);
      expect(result![0].targetModule).toBe("com.myapp.domain.entities.User");
      expect(result![1].targetModule).toBe("com.myapp.infrastructure.db.UserDao");
    });

    it("parses Kotlin wildcard imports", () => {
      const content = `import com.myapp.domain.*`;
      const result = parseImportsMultiLang("App.kt", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].targetModule).toBe("com.myapp.domain.*");
    });
  });

  describe("Rust imports", () => {
    it("parses Rust use statements", () => {
      const content = `use crate::domain::entities::User;
use crate::infrastructure::db;
mod handlers;`;
      const result = parseImportsMultiLang("main.rs", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3);
      expect(result![0].targetModule).toBe("crate::domain::entities::User");
      expect(result![1].targetModule).toBe("crate::infrastructure::db");
      expect(result![2].targetModule).toBe("handlers");
    });

    it("parses Rust grouped use", () => {
      const content = `use crate::domain::{Entity, Value};`;
      const result = parseImportsMultiLang("lib.rs", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].targetModule).toBe("crate::domain");
    });

    it("skips Rust comments", () => {
      const content = `// use fake::module;
use crate::real;`;
      const result = parseImportsMultiLang("main.rs", content);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].targetModule).toBe("crate::real");
    });
  });

  describe("unsupported languages", () => {
    it("returns null for unsupported file extensions", () => {
      const result = parseImportsMultiLang("style.css", "body { color: red; }");
      expect(result).toBeNull();
    });
  });

  describe("resolveLayerFromImport", () => {
    const layers = [
      { name: "domain", paths: ["src/domain/**"] },
      { name: "infrastructure", paths: ["src/infrastructure/**"] },
      { name: "application", paths: ["src/application/**"] },
    ];

    it("resolves a Go import to a layer", () => {
      const result = resolveLayerFromImport("myapp/src/domain/user", "go", layers);
      expect(result).toBe("domain");
    });

    it("resolves a Java import to a layer", () => {
      const result = resolveLayerFromImport("com.myapp.src/infrastructure.persistence", "java", layers);
      expect(result).toBe("infrastructure");
    });

    it("returns null for unmatched import", () => {
      const result = resolveLayerFromImport("fmt", "go", layers);
      expect(result).toBeNull();
    });
  });

  describe("line numbers", () => {
    it("reports correct line numbers for Python", () => {
      const content = `# comment
import os
from domain.models import User`;
      const result = parseImportsMultiLang("app.py", content);
      expect(result).not.toBeNull();
      expect(result![0].line).toBe(2);
      expect(result![1].line).toBe(3);
    });

    it("reports correct line numbers for Java", () => {
      const content = `package com.app;

import com.app.domain.User;
import com.app.infra.Repo;`;
      const result = parseImportsMultiLang("App.java", content);
      expect(result).not.toBeNull();
      expect(result![0].line).toBe(3);
      expect(result![1].line).toBe(4);
    });
  });
});
