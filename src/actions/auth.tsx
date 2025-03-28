"use server";

import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { loginFormSchema, registerFormSchema } from "@/lib/definitions";
import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export const register = async (values: z.infer<typeof registerFormSchema>) => {
  const { username, email, password } = values;
  try {
    const hashedPassword = await hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });

    await createSession(newUser.id);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2002" && Array.isArray(error.meta?.target)) {
        const targetField = error.meta.target[0];

        if (targetField === "username") {
          throw new Error(
            "Username already exists. Please choose a different one."
          );
        }

        if (targetField === "email") {
          throw new Error(
            "Email already exists. Please use a different email address."
          );
        }
      }

      console.error("Error during signup:", error);
      throw new Error("An unexpected error occurred. Please try again later.");
    }
  } finally {
    redirect("/dashboard");
  }
};

export const login = async (values: z.infer<typeof loginFormSchema>) => {
  const { usernameOrEmail, password } = values;

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
      },
    });

    if (!user) {
      throw new Error("Email or username doesn't exist.");
    }

    const isPasswordCorrect = await compare(password, user.password);

    if (!isPasswordCorrect) {
      throw new Error("Invalid credentials.");
    }

    await createSession(user.id);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "Email or username doesn't exist.") {
        throw new Error("Email or username doesn't exist. Please try again.");
      }

      if (error.message === "Invalid credentials.") {
        throw new Error("Invalid credentials. Please check your password.");
      }

      console.error("Error during login:", error);
      throw new Error("An unexpected error occurred. Please try again later.");
    }

    throw new Error("An unknown error occurred.");
  } finally {
    redirect("/dashboard");
  }
};

export const logout = async () => {
  deleteSession();
  redirect("/login");
};
