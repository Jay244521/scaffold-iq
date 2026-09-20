#include "Player/FGCharacter.h"
#include "Player/FGCharacterMovementComponent.h"
#include "Weapons/FGInventoryComponent.h"
#include "Core/FGGameMode.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputActionValue.h"
#include "Net/UnrealNetwork.h"
#include "GameFramework/Controller.h"
#include "GameFramework/PlayerController.h"

AFGCharacter::AFGCharacter(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer.SetDefaultSubobjectClass<UFGCharacterMovementComponent>(ACharacter::CharacterMovementComponentName))
{
	PrimaryActorTick.bCanEverTick = true;
	bReplicates = true;

	FGMovementComponent = Cast<UFGCharacterMovementComponent>(GetCharacterMovement());
	InventoryComponent = CreateDefaultSubobject<UFGInventoryComponent>(TEXT("InventoryComponent"));

	Health = MaxHealth;
}

void AFGCharacter::BeginPlay()
{
	Super::BeginPlay();

	if (APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			if (DefaultMappingContext)
			{
				Subsystem->AddMappingContext(DefaultMappingContext, 0);
			}
		}
	}
}

void AFGCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	if (UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(PlayerInputComponent))
	{
		if (MoveAction)
		{
			EIC->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AFGCharacter::Input_Move);
		}
		if (LookAction)
		{
			EIC->BindAction(LookAction, ETriggerEvent::Triggered, this, &AFGCharacter::Input_Look);
		}
		if (JumpAction)
		{
			EIC->BindAction(JumpAction, ETriggerEvent::Started, this, &AFGCharacter::Input_Jump);
		}
		if (SprintAction)
		{
			EIC->BindAction(SprintAction, ETriggerEvent::Started, this, &AFGCharacter::Input_SprintStart);
			EIC->BindAction(SprintAction, ETriggerEvent::Completed, this, &AFGCharacter::Input_SprintStop);
		}
		if (SlideAction)
		{
			EIC->BindAction(SlideAction, ETriggerEvent::Started, this, &AFGCharacter::Input_SlideStart);
			EIC->BindAction(SlideAction, ETriggerEvent::Completed, this, &AFGCharacter::Input_SlideStop);
		}
	}
}

void AFGCharacter::Input_Move(const FInputActionValue& Value)
{
	if (!Controller)
	{
		return;
	}

	const FVector2D MoveInput = Value.Get<FVector2D>();
	const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);

	AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X), MoveInput.Y);
	AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y), MoveInput.X);
}

void AFGCharacter::Input_Look(const FInputActionValue& Value)
{
	const FVector2D LookInput = Value.Get<FVector2D>();
	AddControllerYawInput(LookInput.X);
	AddControllerPitchInput(LookInput.Y);
}

void AFGCharacter::Input_Jump()
{
	Jump();
}

void AFGCharacter::Input_SprintStart()
{
	if (FGMovementComponent)
	{
		FGMovementComponent->SetWantsToSprint(true);
	}
}

void AFGCharacter::Input_SprintStop()
{
	if (FGMovementComponent)
	{
		FGMovementComponent->SetWantsToSprint(false);
	}
}

void AFGCharacter::Input_SlideStart()
{
	if (FGMovementComponent)
	{
		FGMovementComponent->SetWantsToSlide(true);
	}
}

void AFGCharacter::Input_SlideStop()
{
	if (FGMovementComponent)
	{
		FGMovementComponent->SetWantsToSlide(false);
	}
}

float AFGCharacter::TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	const float ActualDamage = Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);

	if (!HasAuthority() || Health <= 0.f)
	{
		return ActualDamage;
	}

	Health = FMath::Max(0.f, Health - ActualDamage);

	if (Health <= 0.f)
	{
		Eliminate(EventInstigator);
	}

	return ActualDamage;
}

void AFGCharacter::Eliminate(AController* KillerController)
{
	if (AFGGameMode* GameMode = GetWorld()->GetAuthGameMode<AFGGameMode>())
	{
		GameMode->HandlePlayerElimination(GetController(), KillerController);
	}

	DetachFromControllerPendingDestroy();
	SetLifeSpan(0.1f);
}

void AFGCharacter::OnRep_Health()
{
}

void AFGCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(AFGCharacter, Health);
}
