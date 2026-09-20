#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FGSectorGenerator.generated.h"

UENUM(BlueprintType)
enum class EFGSectorType : uint8
{
	Open,
	Urban,
	Forest,
	PointOfInterest
};

USTRUCT(BlueprintType)
struct FFGSectorDefinition
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "ForgeGames|Map")
	FIntPoint GridCoord = FIntPoint::ZeroValue;

	UPROPERTY(BlueprintReadOnly, Category = "ForgeGames|Map")
	EFGSectorType SectorType = EFGSectorType::Open;

	UPROPERTY(BlueprintReadOnly, Category = "ForgeGames|Map")
	FVector WorldLocation = FVector::ZeroVector;
};

/** One sector type's candidate content and how often it should be picked. */
USTRUCT(BlueprintType)
struct FFGSectorTypeEntry
{
	GENERATED_BODY()

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Map")
	EFGSectorType SectorType = EFGSectorType::Open;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Map")
	TArray<TSubclassOf<AActor>> SectorTemplates;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Map", meta = (ClampMin = "0.0"))
	float SelectionWeight = 1.f;
};

/**
 * Server-side procedural map layout: divides the playable land into a grid of sectors,
 * assigns each a type from a weighted table, and spawns that sector's content actor.
 * The layout is deterministic per RandomSeed so a match can be reproduced for testing.
 */
UCLASS()
class FORGEGAMES_API AFGSectorGenerator : public AActor
{
	GENERATED_BODY()

public:
	AFGSectorGenerator();

	/** Server-only: lays out and spawns the sector grid. Called by the game mode during InitGame. */
	UFUNCTION(BlueprintCallable, Category = "ForgeGames|Map")
	void GenerateMap();

	UFUNCTION(BlueprintPure, Category = "ForgeGames|Map")
	const TArray<FFGSectorDefinition>& GetSectorDefinitions() const { return SectorDefinitions; }

protected:
	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Map")
	int32 GridWidth = 8;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Map")
	int32 GridHeight = 8;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Map")
	float SectorSize = 5000.f;

	/** 0 picks a random seed each match; any other value reproduces the same layout. */
	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Map")
	int32 RandomSeed = 0;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Map")
	TArray<FFGSectorTypeEntry> SectorTypeEntries;

private:
	EFGSectorType PickWeightedSectorType(FRandomStream& Stream) const;
	void SpawnSectorContent(const FFGSectorDefinition& SectorDefinition, FRandomStream& Stream);

	UPROPERTY()
	TArray<FFGSectorDefinition> SectorDefinitions;

	UPROPERTY()
	TArray<TObjectPtr<AActor>> SpawnedSectorActors;
};
